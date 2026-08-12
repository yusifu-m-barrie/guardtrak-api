import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  CheckpointVerificationMethod,
  PatrolAssignmentStatus,
  PatrolRouteStatus,
  Prisma,
  SiteStatus,
} from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { buildPaginationMeta } from '../../common/dto/pagination-meta.dto';
import type { RequestUser } from '../../common/types/request-user.type';
import {
  requireOrganisationId,
  tenantNotFound,
} from '../../common/tenant/tenant.util';
import {
  assertAllowedSortField,
  normalisePagination,
} from '../../common/utils/pagination.util';
import {
  normalizePersonName,
  trimOrUndefined,
} from '../../common/utils/normalize.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import { AssignmentAccessService } from '../assignments/assignment-access.service';
import type { ServiceRequestContext } from '../clients/clients.types';
import {
  ACTIVE_PATROL_ASSIGNMENT_STATUSES,
  assertPatrolRouteTransition,
} from '../patrols/patrol-transitions.util';
import type { CreatePatrolRouteDto } from './dto/create-patrol-route.dto';
import type { ListPatrolRoutesQueryDto } from './dto/list-patrol-routes-query.dto';
import type { UpdatePatrolRouteDto } from './dto/update-patrol-route.dto';
import type { UpdatePatrolRouteStatusDto } from './dto/update-patrol-route-status.dto';
import { toPatrolRouteResponse } from './mappers/patrol-route.mapper';

const ROUTE_SORT = ['name', 'status', 'createdAt'] as const;

const ROUTE_INCLUDE = {
  site: {
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      latitude: true,
      longitude: true,
      checkpointDefaultRadiusMeters: true,
      client: { select: { id: true, name: true, status: true } },
    },
  },
  checkpoints: {
    where: { deletedAt: null, active: true },
    orderBy: { sequence: 'asc' as const },
    select: {
      id: true,
      name: true,
      sequence: true,
      verificationMethod: true,
      requiresPhoto: true,
      requiresNote: true,
      active: true,
      allowedRadiusMeters: true,
      qrCodeHash: true,
      latitude: true,
      longitude: true,
    },
  },
  _count: {
    select: {
      assignments: {
        where: { status: { in: [...ACTIVE_PATROL_ASSIGNMENT_STATUSES] } },
      },
    },
  },
} satisfies Prisma.PatrolRouteInclude;

@Injectable()
export class PatrolRoutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuthAuditService,
    private readonly configService: ConfigService,
    private readonly assignmentAccess: AssignmentAccessService,
  ) {}

  async create(
    user: RequestUser,
    dto: CreatePatrolRouteDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    await this.assertSiteActive(organisationId, dto.siteId);
    const name = normalizePersonName(dto.name);

    const duplicate = await this.prisma.patrolRoute.findFirst({
      where: {
        organisationId,
        siteId: dto.siteId,
        name: { equals: name, mode: 'insensitive' },
        deletedAt: null,
        status: { not: PatrolRouteStatus.ARCHIVED },
      },
    });
    if (duplicate) {
      throw new AppException(
        'An active route with this name already exists at the site',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_ROUTE_NAME_CONFLICT,
      );
    }

    const requireSequential =
      this.configService.get<boolean>('patrol.requireSequentialCheckpoints') ??
      true;

    const route = await this.prisma.patrolRoute.create({
      data: {
        organisationId,
        siteId: dto.siteId,
        name,
        description: trimOrUndefined(dto.description) ?? null,
        instructions: trimOrUndefined(dto.instructions) ?? null,
        estimatedDurationMinutes: dto.estimatedDurationMinutes ?? null,
        requireSequentialCompletion: requireSequential,
        status: PatrolRouteStatus.DRAFT,
        createdByUserId: user.id,
      },
      include: ROUTE_INCLUDE,
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      entityType: 'PatrolRoute',
      entityId: route.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return toPatrolRouteResponse(route);
  }

  async findAll(user: RequestUser, query: ListPatrolRoutesQueryDto) {
    const organisationId = requireOrganisationId(user);
    const scope = await this.assignmentAccess.resolveSupervisorOperationalScope(
      user,
      organisationId,
    );
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const sortBy = assertAllowedSortField(query.sortBy, ROUTE_SORT, 'name');
    const sortOrder = query.sortOrder ?? 'asc';

    const where: Prisma.PatrolRouteWhereInput = {
      organisationId,
      ...(scope
        ? { siteId: this.assignmentAccess.emptySafeInFilter(scope.siteIds) }
        : {}),
      ...(query.includeArchived
        ? {}
        : {
            deletedAt: null,
            ...(query.status
              ? { status: query.status }
              : { status: { not: PatrolRouteStatus.ARCHIVED } }),
          }),
      ...(query.includeArchived && query.status
        ? { status: query.status }
        : {}),
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.clientId ? { site: { clientId: query.clientId } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              {
                description: { contains: query.search, mode: 'insensitive' },
              },
              {
                site: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                site: {
                  code: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.patrolRoute.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy!]: sortOrder },
        include: ROUTE_INCLUDE,
      }),
      this.prisma.patrolRoute.count({ where }),
    ]);

    return {
      data: items.map((r) => toPatrolRouteResponse(r)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(user: RequestUser, id: string) {
    const organisationId = requireOrganisationId(user);
    const scope = await this.assignmentAccess.resolveSupervisorOperationalScope(
      user,
      organisationId,
    );
    const route = await this.prisma.patrolRoute.findFirst({
      where: {
        id,
        organisationId,
        deletedAt: null,
        ...(scope
          ? { siteId: this.assignmentAccess.emptySafeInFilter(scope.siteIds) }
          : {}),
      },
      include: ROUTE_INCLUDE,
    });
    if (!route) {
      tenantNotFound(ErrorCode.PATROL_ROUTE_NOT_FOUND);
    }
    return toPatrolRouteResponse(route);
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdatePatrolRouteDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findRouteOrThrow(organisationId, id);

    if (existing.status === PatrolRouteStatus.ARCHIVED) {
      throw new AppException(
        'Archived routes cannot be edited',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_ROUTE_STATUS_INVALID,
      );
    }

    const updated = await this.prisma.patrolRoute.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined
          ? { name: normalizePersonName(dto.name) }
          : {}),
        ...(dto.description !== undefined
          ? { description: trimOrUndefined(dto.description) ?? null }
          : {}),
        ...(dto.instructions !== undefined
          ? { instructions: trimOrUndefined(dto.instructions) ?? null }
          : {}),
        ...(dto.estimatedDurationMinutes !== undefined
          ? { estimatedDurationMinutes: dto.estimatedDurationMinutes }
          : {}),
      },
      include: ROUTE_INCLUDE,
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'PatrolRoute',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { fields: Object.keys(dto) },
    });

    return toPatrolRouteResponse(updated);
  }

  async updateStatus(
    user: RequestUser,
    id: string,
    dto: UpdatePatrolRouteStatusDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findRouteOrThrow(organisationId, id);
    assertPatrolRouteTransition(existing.status, dto.status);

    if (dto.status === PatrolRouteStatus.ACTIVE) {
      await this.assertCanActivate(organisationId, existing);
    }

    if (dto.status === PatrolRouteStatus.ARCHIVED) {
      await this.assertNoActiveAssignments(organisationId, existing.id);
    }

    const updated = await this.prisma.patrolRoute.update({
      where: { id: existing.id },
      data: {
        status: dto.status,
        ...(dto.status === PatrolRouteStatus.ARCHIVED
          ? { deletedAt: new Date() }
          : {}),
      },
      include: ROUTE_INCLUDE,
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'PatrolRoute',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        previousStatus: existing.status,
        newStatus: dto.status,
      },
    });

    return toPatrolRouteResponse(updated);
  }

  async archive(user: RequestUser, id: string, ctx: ServiceRequestContext) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findRouteOrThrow(organisationId, id);
    if (existing.status === PatrolRouteStatus.ARCHIVED) {
      return;
    }
    await this.assertNoActiveAssignments(organisationId, existing.id);
    assertPatrolRouteTransition(existing.status, PatrolRouteStatus.ARCHIVED);
    await this.prisma.patrolRoute.update({
      where: { id: existing.id },
      data: {
        status: PatrolRouteStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });
    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.DELETE,
      entityType: 'PatrolRoute',
      entityId: existing.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { softArchive: true },
    });
  }

  private async findRouteOrThrow(organisationId: string, id: string) {
    const route = await this.prisma.patrolRoute.findFirst({
      where: { id, organisationId, deletedAt: null },
      include: ROUTE_INCLUDE,
    });
    if (!route) {
      tenantNotFound(ErrorCode.PATROL_ROUTE_NOT_FOUND);
    }
    return route;
  }

  private async assertSiteActive(
    organisationId: string,
    siteId: string,
  ): Promise<void> {
    const site = await this.prisma.securitySite.findFirst({
      where: { id: siteId, organisationId, deletedAt: null },
      select: { status: true },
    });
    if (!site || site.status !== SiteStatus.ACTIVE) {
      tenantNotFound(ErrorCode.SITE_NOT_FOUND);
    }
  }

  private async assertCanActivate(
    organisationId: string,
    route: { id: string; siteId: string },
  ): Promise<void> {
    await this.assertSiteActive(organisationId, route.siteId);
    const checkpoints = await this.prisma.patrolCheckpoint.findMany({
      where: {
        patrolRouteId: route.id,
        organisationId,
        deletedAt: null,
        active: true,
      },
      orderBy: { sequence: 'asc' },
    });
    if (checkpoints.length === 0) {
      throw new AppException(
        'Route cannot activate without checkpoints',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_ROUTE_HAS_NO_CHECKPOINTS,
      );
    }
    for (let i = 0; i < checkpoints.length; i += 1) {
      if (checkpoints[i].sequence !== i + 1) {
        throw new AppException(
          'Checkpoint sequences must be contiguous starting at 1',
          HttpStatus.CONFLICT,
          ErrorCode.PATROL_ROUTE_CHECKPOINTS_INVALID,
        );
      }
      const method = checkpoints[i].verificationMethod;
      if (
        (method === CheckpointVerificationMethod.QR_CODE ||
          method === CheckpointVerificationMethod.GPS_AND_QR) &&
        !checkpoints[i].qrCodeHash
      ) {
        throw new AppException(
          'QR checkpoints require a configured QR value',
          HttpStatus.CONFLICT,
          ErrorCode.PATROL_CHECKPOINT_QR_REQUIRED,
        );
      }
    }
  }

  private async assertNoActiveAssignments(
    organisationId: string,
    routeId: string,
  ): Promise<void> {
    const active = await this.prisma.patrolAssignment.count({
      where: {
        organisationId,
        patrolRouteId: routeId,
        status: {
          in: [
            PatrolAssignmentStatus.NOT_STARTED,
            PatrolAssignmentStatus.IN_PROGRESS,
            PatrolAssignmentStatus.REQUIRES_REVIEW,
          ],
        },
      },
    });
    if (active > 0) {
      throw new AppException(
        'Route has active patrol assignments',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_ROUTE_HAS_ACTIVE_ASSIGNMENTS,
      );
    }
  }
}
