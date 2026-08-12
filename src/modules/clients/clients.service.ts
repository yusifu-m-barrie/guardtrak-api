import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AuditAction,
  ClientStatus,
  Prisma,
  SiteStatus,
} from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { buildPaginationMeta } from '../../common/dto/pagination-meta.dto';
import type { RequestUser } from '../../common/types/request-user.type';
import {
  assertSameOrganisation,
  requireOrganisationId,
  tenantNotFound,
} from '../../common/tenant/tenant.util';
import {
  assertAllowedSortField,
  normalisePagination,
} from '../../common/utils/pagination.util';
import {
  normalizeEmail,
  normalizePersonName,
  normalizePhone,
  trimOrUndefined,
} from '../../common/utils/normalize.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import { AssignmentAccessService } from '../assignments/assignment-access.service';
import type { CreateClientDto } from './dto/create-client.dto';
import type { ListClientsQueryDto } from './dto/list-clients-query.dto';
import type { UpdateClientDto } from './dto/update-client.dto';
import type { UpdateClientStatusDto } from './dto/update-client-status.dto';
import { toClientResponse } from './mappers/client.mapper';
import type { ServiceRequestContext } from './clients.types';

const CLIENT_SORT_FIELDS = [
  'name',
  'legalName',
  'status',
  'createdAt',
  'primaryContactName',
] as const;

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuthAuditService,
    private readonly assignmentAccess: AssignmentAccessService,
  ) {}

  async create(
    user: RequestUser,
    dto: CreateClientDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const name = normalizePersonName(dto.name);
    const registrationNumber = trimOrUndefined(dto.registrationNumber);

    if (registrationNumber) {
      await this.assertRegistrationAvailable(
        organisationId,
        registrationNumber,
      );
    }

    try {
      const client = await this.prisma.client.create({
        data: {
          organisationId,
          name,
          legalName: trimOrUndefined(dto.legalName) ?? null,
          registrationNumber: registrationNumber ?? null,
          primaryContactName: normalizePersonName(dto.primaryContactName),
          primaryContactEmail: dto.primaryContactEmail
            ? normalizeEmail(dto.primaryContactEmail)
            : null,
          primaryContactPhone: normalizePhone(dto.primaryContactPhone),
          billingAddress: trimOrUndefined(dto.billingAddress) ?? null,
          operationalNotes: trimOrUndefined(dto.operationalNotes) ?? null,
          status: ClientStatus.ACTIVE,
        },
      });

      await this.auditService.record({
        organisationId,
        actorUserId: user.id,
        action: AuditAction.CREATE,
        entityType: 'Client',
        entityId: client.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      return toClientResponse(client);
    } catch (error) {
      this.handleUniqueViolation(error, registrationNumber);
      throw error;
    }
  }

  async findAll(user: RequestUser, query: ListClientsQueryDto) {
    const organisationId = requireOrganisationId(user);
    const scope = await this.assignmentAccess.resolveSupervisorOperationalScope(
      user,
      organisationId,
    );
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const sortBy = assertAllowedSortField(
      query.sortBy,
      CLIENT_SORT_FIELDS,
      'name',
    );
    const sortOrder = query.sortOrder ?? 'asc';

    const where: Prisma.ClientWhereInput = {
      organisationId,
      ...(scope
        ? { id: this.assignmentAccess.emptySafeInFilter(scope.clientIds) }
        : {}),
      ...(query.includeArchived
        ? {}
        : { deletedAt: null, status: { not: ClientStatus.ARCHIVED } }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { legalName: { contains: query.search, mode: 'insensitive' } },
              {
                registrationNumber: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                primaryContactName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                primaryContactEmail: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                primaryContactPhone: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy!]: sortOrder },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data: items.map((client) => toClientResponse(client)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(user: RequestUser, id: string) {
    const organisationId = requireOrganisationId(user);
    const client = await this.findClientOrThrow(organisationId, id);
    const scope = await this.assignmentAccess.resolveSupervisorOperationalScope(
      user,
      organisationId,
    );
    if (scope && !scope.clientIds.includes(client.id)) {
      tenantNotFound(ErrorCode.CLIENT_NOT_FOUND);
    }
    const siteCount = await this.prisma.securitySite.count({
      where: {
        clientId: client.id,
        organisationId,
        deletedAt: null,
        status: { not: SiteStatus.ARCHIVED },
        ...(scope
          ? { id: this.assignmentAccess.emptySafeInFilter(scope.siteIds) }
          : {}),
      },
    });

    return toClientResponse(client, siteCount);
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateClientDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findClientOrThrow(organisationId, id);

    const registrationNumber =
      dto.registrationNumber !== undefined
        ? (trimOrUndefined(dto.registrationNumber) ?? null)
        : undefined;

    if (
      registrationNumber &&
      registrationNumber !== existing.registrationNumber
    ) {
      await this.assertRegistrationAvailable(
        organisationId,
        registrationNumber,
        id,
      );
    }

    const data: Prisma.ClientUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = normalizePersonName(dto.name);
    }
    if (dto.legalName !== undefined) {
      data.legalName = trimOrUndefined(dto.legalName) ?? null;
    }
    if (registrationNumber !== undefined) {
      data.registrationNumber = registrationNumber;
    }
    if (dto.primaryContactName !== undefined) {
      data.primaryContactName = normalizePersonName(dto.primaryContactName);
    }
    if (dto.primaryContactEmail !== undefined) {
      data.primaryContactEmail = dto.primaryContactEmail
        ? normalizeEmail(dto.primaryContactEmail)
        : null;
    }
    if (dto.primaryContactPhone !== undefined) {
      data.primaryContactPhone = normalizePhone(dto.primaryContactPhone);
    }
    if (dto.billingAddress !== undefined) {
      data.billingAddress = trimOrUndefined(dto.billingAddress) ?? null;
    }
    if (dto.operationalNotes !== undefined) {
      data.operationalNotes = trimOrUndefined(dto.operationalNotes) ?? null;
    }

    try {
      const client = await this.prisma.client.update({
        where: { id: existing.id },
        data,
      });

      await this.auditService.record({
        organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'Client',
        entityId: client.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { changedFields: Object.keys(data) },
      });

      return toClientResponse(client);
    } catch (error) {
      this.handleUniqueViolation(error, registrationNumber ?? undefined);
      throw error;
    }
  }

  async updateStatus(
    user: RequestUser,
    id: string,
    dto: UpdateClientStatusDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findClientOrThrow(organisationId, id);

    if (dto.status === ClientStatus.ARCHIVED) {
      await this.assertNoActiveSites(organisationId, id);
    }

    const client = await this.prisma.client.update({
      where: { id: existing.id },
      data: {
        status: dto.status,
        ...(dto.status === ClientStatus.ARCHIVED
          ? { deletedAt: new Date() }
          : {}),
      },
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'Client',
      entityId: client.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        previousStatus: existing.status,
        newStatus: dto.status,
        reason: dto.reason ?? null,
      },
    });

    return toClientResponse(client);
  }

  async archive(
    user: RequestUser,
    id: string,
    ctx: ServiceRequestContext,
  ): Promise<void> {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findClientOrThrow(organisationId, id);

    await this.assertNoActiveSites(organisationId, id);

    await this.prisma.client.update({
      where: { id: existing.id },
      data: {
        status: ClientStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.DELETE,
      entityType: 'Client',
      entityId: existing.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  private async findClientOrThrow(organisationId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, organisationId, deletedAt: null },
    });

    if (!client) {
      throw new AppException(
        'Client not found',
        HttpStatus.NOT_FOUND,
        ErrorCode.CLIENT_NOT_FOUND,
      );
    }

    assertSameOrganisation(organisationId, client.organisationId);
    return client;
  }

  private async assertRegistrationAvailable(
    organisationId: string,
    registrationNumber: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.client.findFirst({
      where: {
        organisationId,
        registrationNumber,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new AppException(
        'Client registration number already exists in this organisation',
        HttpStatus.CONFLICT,
        ErrorCode.CLIENT_REGISTRATION_CONFLICT,
      );
    }
  }

  async assertNoActiveSites(
    organisationId: string,
    clientId: string,
  ): Promise<void> {
    const activeSiteCount = await this.prisma.securitySite.count({
      where: {
        organisationId,
        clientId,
        status: SiteStatus.ACTIVE,
        deletedAt: null,
      },
    });

    if (activeSiteCount > 0) {
      throw new AppException(
        'Client cannot be archived while active sites exist',
        HttpStatus.CONFLICT,
        ErrorCode.CLIENT_HAS_ACTIVE_SITES,
      );
    }
  }

  private handleUniqueViolation(
    error: unknown,
    registrationNumber?: string,
  ): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target : [];

      if (registrationNumber && fields.includes('registrationNumber')) {
        throw new AppException(
          'Client registration number already exists in this organisation',
          HttpStatus.CONFLICT,
          ErrorCode.CLIENT_REGISTRATION_CONFLICT,
        );
      }

      throw new AppException(
        'A client with this value already exists in this organisation',
        HttpStatus.CONFLICT,
        ErrorCode.CONFLICT,
      );
    }
  }
}
