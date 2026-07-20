import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AuditAction,
  GeofencePolicy,
  Prisma,
  SiteStatus,
} from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { buildPaginationMeta } from '../../common/dto/pagination-meta.dto';
import type { RequestUser } from '../../common/types/request-user.type';
import {
  assertPermission,
  assertSameOrganisation,
  requireOrganisationId,
} from '../../common/tenant/tenant.util';
import {
  assertAllowedSortField,
  normalisePagination,
} from '../../common/utils/pagination.util';
import {
  normalizeCode,
  normalizePersonName,
  normalizePhone,
  trimOrUndefined,
} from '../../common/utils/normalize.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import type { ServiceRequestContext } from '../clients/clients.types';
import type { CreateSiteDto } from './dto/create-site.dto';
import type { ListSitesQueryDto } from './dto/list-sites-query.dto';
import type { UpdateSiteDto } from './dto/update-site.dto';
import type { UpdateSiteStatusDto } from './dto/update-site-status.dto';
import { toSiteResponse } from './mappers/site.mapper';
import { validateSiteGeoFields } from './sites-validation.util';

const SITE_SORT_FIELDS = ['name', 'code', 'status', 'createdAt'] as const;

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuthAuditService,
  ) {}

  async create(
    user: RequestUser,
    dto: CreateSiteDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    validateSiteGeoFields(dto);
    await this.assertClientInOrganisation(organisationId, dto.clientId);

    const code = normalizeCode(dto.code);

    try {
      const site = await this.prisma.securitySite.create({
        data: {
          organisationId,
          clientId: dto.clientId,
          name: normalizePersonName(dto.name),
          code,
          address: dto.address.trim(),
          latitude: new Prisma.Decimal(dto.latitude),
          longitude: new Prisma.Decimal(dto.longitude),
          clockInRadiusMeters: dto.clockInRadiusMeters,
          clockOutRadiusMeters: dto.clockOutRadiusMeters,
          checkpointDefaultRadiusMeters:
            dto.checkpointDefaultRadiusMeters ?? 50,
          minimumGpsAccuracyMeters: dto.minimumGpsAccuracyMeters ?? 50,
          clockInOutsideGeofencePolicy:
            dto.clockInOutsideGeofencePolicy ??
            GeofencePolicy.REQUIRE_SUPERVISOR_APPROVAL,
          clockOutOutsideGeofencePolicy:
            dto.clockOutOutsideGeofencePolicy ??
            GeofencePolicy.ALLOW_WITH_REASON,
          requiresClockInSelfie: dto.requiresClockInSelfie ?? false,
          requiresClockOutSelfie: dto.requiresClockOutSelfie ?? false,
          requiresPatrol: dto.requiresPatrol ?? false,
          requiresFinalShiftNote: dto.requiresFinalShiftNote ?? false,
          instructions: trimOrUndefined(dto.instructions) ?? null,
          emergencyContactName:
            trimOrUndefined(dto.emergencyContactName) ?? null,
          emergencyContactPhone: normalizePhone(dto.emergencyContactPhone),
          status: SiteStatus.ACTIVE,
        },
        include: {
          client: { select: { id: true, name: true, status: true } },
        },
      });

      await this.auditService.record({
        organisationId,
        actorUserId: user.id,
        action: AuditAction.CREATE,
        entityType: 'SecuritySite',
        entityId: site.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      return toSiteResponse(site);
    } catch (error) {
      this.handleUniqueViolation(error);
      throw error;
    }
  }

  async findAll(user: RequestUser, query: ListSitesQueryDto) {
    const organisationId = requireOrganisationId(user);
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const sortBy = assertAllowedSortField(
      query.sortBy,
      SITE_SORT_FIELDS,
      'name',
    );
    const sortOrder = query.sortOrder ?? 'asc';

    const where: Prisma.SecuritySiteWhereInput = {
      organisationId,
      ...(query.includeArchived
        ? {}
        : { deletedAt: null, status: { not: SiteStatus.ARCHIVED } }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.requiresPatrol !== undefined
        ? { requiresPatrol: query.requiresPatrol }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
              { address: { contains: query.search, mode: 'insensitive' } },
              {
                client: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.securitySite.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy!]: sortOrder },
        include: {
          client: { select: { id: true, name: true, status: true } },
        },
      }),
      this.prisma.securitySite.count({ where }),
    ]);

    return {
      data: items.map((site) => toSiteResponse(site)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(user: RequestUser, id: string) {
    const organisationId = requireOrganisationId(user);
    const site = await this.findSiteOrThrow(organisationId, id);
    return toSiteResponse(site);
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateSiteDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findSiteOrThrow(organisationId, id);

    validateSiteGeoFields(dto);

    if (dto.clientId !== undefined && dto.clientId !== existing.clientId) {
      assertPermission(user, 'site:update');
      await this.assertClientInOrganisation(organisationId, dto.clientId);

      await this.auditService.record({
        organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'SecuritySite',
        entityId: existing.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: {
          previousClientId: existing.clientId,
          newClientId: dto.clientId,
        },
      });
    }

    const data: Prisma.SecuritySiteUpdateInput = {};

    if (dto.clientId !== undefined) {
      data.client = { connect: { id: dto.clientId } };
    }
    if (dto.name !== undefined) {
      data.name = normalizePersonName(dto.name);
    }
    if (dto.code !== undefined) {
      data.code = normalizeCode(dto.code);
    }
    if (dto.address !== undefined) {
      data.address = dto.address.trim();
    }
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      data.latitude = new Prisma.Decimal(dto.latitude);
      data.longitude = new Prisma.Decimal(dto.longitude);
    }
    if (dto.clockInRadiusMeters !== undefined) {
      data.clockInRadiusMeters = dto.clockInRadiusMeters;
    }
    if (dto.clockOutRadiusMeters !== undefined) {
      data.clockOutRadiusMeters = dto.clockOutRadiusMeters;
    }
    if (dto.checkpointDefaultRadiusMeters !== undefined) {
      data.checkpointDefaultRadiusMeters = dto.checkpointDefaultRadiusMeters;
    }
    if (dto.minimumGpsAccuracyMeters !== undefined) {
      data.minimumGpsAccuracyMeters = dto.minimumGpsAccuracyMeters;
    }
    if (dto.clockInOutsideGeofencePolicy !== undefined) {
      data.clockInOutsideGeofencePolicy = dto.clockInOutsideGeofencePolicy;
    }
    if (dto.clockOutOutsideGeofencePolicy !== undefined) {
      data.clockOutOutsideGeofencePolicy = dto.clockOutOutsideGeofencePolicy;
    }
    if (dto.requiresClockInSelfie !== undefined) {
      data.requiresClockInSelfie = dto.requiresClockInSelfie;
    }
    if (dto.requiresClockOutSelfie !== undefined) {
      data.requiresClockOutSelfie = dto.requiresClockOutSelfie;
    }
    if (dto.requiresPatrol !== undefined) {
      data.requiresPatrol = dto.requiresPatrol;
    }
    if (dto.requiresFinalShiftNote !== undefined) {
      data.requiresFinalShiftNote = dto.requiresFinalShiftNote;
    }
    if (dto.instructions !== undefined) {
      data.instructions = trimOrUndefined(dto.instructions) ?? null;
    }
    if (dto.emergencyContactName !== undefined) {
      data.emergencyContactName =
        trimOrUndefined(dto.emergencyContactName) ?? null;
    }
    if (dto.emergencyContactPhone !== undefined) {
      data.emergencyContactPhone = normalizePhone(dto.emergencyContactPhone);
    }

    try {
      const site = await this.prisma.securitySite.update({
        where: { id: existing.id },
        data,
        include: {
          client: { select: { id: true, name: true, status: true } },
        },
      });

      await this.auditService.record({
        organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'SecuritySite',
        entityId: site.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { changedFields: Object.keys(dto) },
      });

      return toSiteResponse(site);
    } catch (error) {
      this.handleUniqueViolation(error);
      throw error;
    }
  }

  /**
   * Future constraint (Phase 5): do not archive a site that has future
   * scheduled shifts. Shift APIs will enforce this once implemented.
   */
  async updateStatus(
    user: RequestUser,
    id: string,
    dto: UpdateSiteStatusDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findSiteOrThrow(organisationId, id);

    const site = await this.prisma.securitySite.update({
      where: { id: existing.id },
      data: {
        status: dto.status,
        ...(dto.status === SiteStatus.ARCHIVED
          ? { deletedAt: new Date() }
          : {}),
      },
      include: {
        client: { select: { id: true, name: true, status: true } },
      },
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'SecuritySite',
      entityId: site.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        previousStatus: existing.status,
        newStatus: dto.status,
        reason: dto.reason ?? null,
      },
    });

    return toSiteResponse(site);
  }

  async archive(
    user: RequestUser,
    id: string,
    ctx: ServiceRequestContext,
  ): Promise<void> {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findSiteOrThrow(organisationId, id);

    await this.prisma.securitySite.update({
      where: { id: existing.id },
      data: {
        status: SiteStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.DELETE,
      entityType: 'SecuritySite',
      entityId: existing.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  private async findSiteOrThrow(organisationId: string, id: string) {
    const site = await this.prisma.securitySite.findFirst({
      where: { id, organisationId, deletedAt: null },
      include: {
        client: { select: { id: true, name: true, status: true } },
      },
    });

    if (!site) {
      throw new AppException(
        'Site not found',
        HttpStatus.NOT_FOUND,
        ErrorCode.SITE_NOT_FOUND,
      );
    }

    assertSameOrganisation(organisationId, site.organisationId);
    return site;
  }

  private async assertClientInOrganisation(
    organisationId: string,
    clientId: string,
  ): Promise<void> {
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        organisationId,
        deletedAt: null,
      },
    });

    if (!client) {
      throw new AppException(
        'Client does not belong to this organisation',
        HttpStatus.BAD_REQUEST,
        ErrorCode.SITE_CLIENT_INVALID,
      );
    }
  }

  private handleUniqueViolation(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new AppException(
        'Site code already exists in this organisation',
        HttpStatus.CONFLICT,
        ErrorCode.SITE_CODE_CONFLICT,
      );
    }
  }
}
