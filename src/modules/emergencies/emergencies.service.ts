import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AccountStatus,
  AuditAction,
  EmergencyStatus,
  NotificationPriority,
  NotificationType,
  Prisma,
  UserRole as PrismaUserRole,
} from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { UserRole } from '../../common/enums/user-role.enum';
import { buildPaginationMeta } from '../../common/dto/pagination-meta.dto';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { hashRequestPayload } from '../../common/idempotency/request-hash.util';
import type { RequestUser } from '../../common/types/request-user.type';
import {
  requireOrganisationId,
  tenantNotFound,
  userHasPermission,
} from '../../common/tenant/tenant.util';
import { normalisePagination } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import type { ServiceRequestContext } from '../clients/clients.types';
import { AssignmentAccessService } from '../assignments/assignment-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateSosDto } from './dto/create-sos.dto';
import type { ListEmergenciesQueryDto } from './dto/list-emergencies-query.dto';
import type { UpdateEmergencyStatusDto } from './dto/update-emergency-status.dto';
import {
  assertEmergencyTransition,
  toDbEmergencyStatus,
} from './emergency-transitions.util';
import { toEmergencyResponse } from './mappers/emergency.mapper';

@Injectable()
export class EmergenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly idempotencyService: IdempotencyService,
    private readonly auditService: AuthAuditService,
    private readonly notificationsService: NotificationsService,
    private readonly assignmentAccess: AssignmentAccessService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createSos(
    user: RequestUser,
    dto: CreateSosDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const ttl =
      this.configService.get<number>('emergency.idempotencyTtlSeconds') ??
      86_400;
    const requestHash = hashRequestPayload({
      deviceCreatedAt: dto.deviceCreatedAt,
      latitude: dto.latitude,
      longitude: dto.longitude,
      localEmergencyId: dto.localEmergencyId ?? null,
    });
    const begin = await this.idempotencyService.begin({
      key: dto.idempotencyKey,
      organisationId,
      userId: user.id,
      operation: 'emergency.sos',
      requestHash,
      ttlSeconds: ttl,
    });
    if (begin.replay && begin.record?.responseBody) {
      return begin.record.responseBody;
    }
    try {
      const response = await this.performSos(user, organisationId, dto, ctx);
      await this.idempotencyService.complete(
        user.id,
        dto.idempotencyKey,
        201,
        response,
      );
      return response;
    } catch (error) {
      await this.idempotencyService.fail(
        user.id,
        dto.idempotencyKey,
        error instanceof Error ? error.message : 'sos failed',
      );
      throw error;
    }
  }

  private async performSos(
    user: RequestUser,
    organisationId: string,
    dto: CreateSosDto,
    ctx: ServiceRequestContext,
  ) {
    const officerId = await this.assignmentAccess.resolveOfficerProfileId(
      user,
      organisationId,
    );
    if (!officerId) {
      throw new AppException(
        'Officer profile required for SOS',
        HttpStatus.FORBIDDEN,
        ErrorCode.OFFICER_NOT_FOUND,
      );
    }
    if (dto.localEmergencyId) {
      const existing = await this.prisma.emergency.findFirst({
        where: { organisationId, localEmergencyId: dto.localEmergencyId },
      });
      if (existing) {
        return toEmergencyResponse(existing);
      }
    }
    const emergencyNumber = await this.nextNumber(organisationId);
    const now = new Date();
    const emergency = await this.prisma.emergency.create({
      data: {
        organisationId,
        emergencyNumber,
        officerId,
        userId: user.id,
        assignmentId: dto.assignmentId ?? null,
        shiftId: dto.shiftId ?? null,
        siteId: dto.siteId ?? null,
        deviceId: dto.deviceId ?? user.deviceId ?? null,
        status: EmergencyStatus.CREATED,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyMeters: dto.accuracyMeters ?? null,
        deviceCreatedAt: new Date(dto.deviceCreatedAt),
        serverCreatedAt: now,
        localEmergencyId: dto.localEmergencyId ?? null,
        statusEvents: {
          create: {
            organisationId,
            previousStatus: null,
            newStatus: EmergencyStatus.CREATED,
            actorUserId: user.id,
            note: 'SOS created',
            occurredAt: now,
          },
        },
      },
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      entityType: 'Emergency',
      entityId: emergency.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    const recipients = await this.prisma.user.findMany({
      where: {
        organisationId,
        role: { in: [PrismaUserRole.SUPERVISOR, PrismaUserRole.ADMINISTRATOR] },
        status: AccountStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true },
    });
    await this.notificationsService.notifyUsers(
      organisationId,
      recipients.map((r) => r.id),
      {
        type: NotificationType.SOS_ALERT,
        title: 'SOS alert',
        body: `Officer triggered SOS (${emergencyNumber}).`,
        priority: NotificationPriority.CRITICAL,
        data: { emergencyId: emergency.id },
        actorUserId: user.id,
        requestId: ctx.requestId,
      },
    );

    this.eventEmitter.emit('sos.triggered', {
      organisationId,
      emergencyId: emergency.id,
      actorUserId: user.id,
    });

    return toEmergencyResponse(emergency);
  }

  async findAll(user: RequestUser, query: ListEmergenciesQueryDto) {
    const organisationId = requireOrganisationId(user);
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const where = await this.scopeWhere(user, organisationId, query.status);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.emergency.count({ where }),
      this.prisma.emergency.findMany({
        where,
        orderBy: { serverCreatedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return {
      data: rows.map(toEmergencyResponse),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async history(user: RequestUser, query: ListEmergenciesQueryDto) {
    return this.findAll(user, query);
  }

  async findOne(user: RequestUser, id: string) {
    const organisationId = requireOrganisationId(user);
    const row = await this.prisma.emergency.findFirst({
      where: { id, organisationId },
    });
    if (!row) {
      tenantNotFound(ErrorCode.EMERGENCY_NOT_FOUND);
    }
    await this.assertCanRead(user, organisationId, row);
    return toEmergencyResponse(row);
  }

  async updateStatus(
    user: RequestUser,
    id: string,
    dto: UpdateEmergencyStatusDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    if (
      !userHasPermission(user, 'emergency:manage') &&
      !userHasPermission(user, 'sos:respond')
    ) {
      throw new AppException(
        'Insufficient permissions',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      );
    }
    const row = await this.prisma.emergency.findFirst({
      where: { id, organisationId },
    });
    if (!row) {
      tenantNotFound(ErrorCode.EMERGENCY_NOT_FOUND);
    }
    const next = toDbEmergencyStatus(dto.status);
    assertEmergencyTransition(row.status, next);
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.EmergencyUpdateInput = {
        status: next,
        ...(dto.resolutionNotes !== undefined
          ? { resolutionNotes: dto.resolutionNotes }
          : {}),
        ...(dto.cancellationReason !== undefined
          ? { cancellationReason: dto.cancellationReason }
          : {}),
      };
      if (next === EmergencyStatus.ACKNOWLEDGED) {
        data.acknowledgedAt = row.acknowledgedAt ?? now;
        data.acknowledgedBy = { connect: { id: user.id } };
      }
      if (next === EmergencyStatus.RESPONDING) {
        data.respondingAt = row.respondingAt ?? now;
      }
      if (
        next === EmergencyStatus.RESOLVED ||
        next === EmergencyStatus.FALSE_ALARM ||
        next === EmergencyStatus.CANCELLED
      ) {
        data.resolvedAt = row.resolvedAt ?? now;
        data.resolvedBy = { connect: { id: user.id } };
      }
      const emergency = await tx.emergency.update({
        where: { id },
        data,
      });
      await tx.emergencyStatusEvent.create({
        data: {
          organisationId,
          emergencyId: id,
          previousStatus: row.status,
          newStatus: next,
          actorUserId: user.id,
          note: dto.note ?? null,
          occurredAt: now,
        },
      });
      return emergency;
    });
    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'Emergency',
      entityId: id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { from: row.status, to: next },
    });
    this.eventEmitter.emit('sos.resolved', {
      organisationId,
      emergencyId: id,
      actorUserId: user.id,
      status: next,
    });
    return toEmergencyResponse(updated);
  }

  private async nextNumber(organisationId: string): Promise<string> {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `SOS-${day}-`;
    const latest = await this.prisma.emergency.findFirst({
      where: { organisationId, emergencyNumber: { startsWith: prefix } },
      orderBy: { emergencyNumber: 'desc' },
      select: { emergencyNumber: true },
    });
    let seq = 1;
    if (latest?.emergencyNumber) {
      const parsed = Number.parseInt(
        latest.emergencyNumber.slice(prefix.length),
        10,
      );
      if (!Number.isNaN(parsed)) {
        seq = parsed + 1;
      }
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private async scopeWhere(
    user: RequestUser,
    organisationId: string,
    status?: string,
  ): Promise<Prisma.EmergencyWhereInput> {
    const statusFilter = status ? { status: toDbEmergencyStatus(status) } : {};
    if (
      userHasPermission(user, 'emergency:manage') ||
      user.role === UserRole.ADMINISTRATOR
    ) {
      return { organisationId, ...statusFilter };
    }
    if (user.role === UserRole.SUPERVISOR) {
      const supervisorProfileId =
        await this.assignmentAccess.resolveSupervisorProfileId(
          user,
          organisationId,
        );
      if (!supervisorProfileId) {
        return { organisationId, officerId: { in: [] }, ...statusFilter };
      }
      const officerIds = await this.assignmentAccess.listAssignedOfficerIds(
        organisationId,
        supervisorProfileId,
      );
      return {
        organisationId,
        officerId: { in: officerIds },
        ...statusFilter,
      };
    }
    if (userHasPermission(user, 'emergency:read')) {
      return { organisationId, ...statusFilter };
    }
    return { organisationId, userId: user.id, ...statusFilter };
  }

  private async assertCanRead(
    user: RequestUser,
    organisationId: string,
    row: { userId: string; officerId: string },
  ): Promise<void> {
    if (
      userHasPermission(user, 'emergency:manage') ||
      user.role === UserRole.ADMINISTRATOR
    ) {
      return;
    }
    if (user.role === UserRole.SUPERVISOR) {
      const supervisorProfileId =
        await this.assignmentAccess.resolveSupervisorProfileId(
          user,
          organisationId,
        );
      if (!supervisorProfileId) {
        tenantNotFound(ErrorCode.EMERGENCY_NOT_FOUND);
      }
      const officerIds = await this.assignmentAccess.listAssignedOfficerIds(
        organisationId,
        supervisorProfileId,
      );
      if (officerIds.includes(row.officerId)) {
        return;
      }
      tenantNotFound(ErrorCode.EMERGENCY_NOT_FOUND);
    }
    if (userHasPermission(user, 'emergency:read')) {
      return;
    }
    if (row.userId === user.id) {
      return;
    }
    tenantNotFound(ErrorCode.EMERGENCY_NOT_FOUND);
  }
}
