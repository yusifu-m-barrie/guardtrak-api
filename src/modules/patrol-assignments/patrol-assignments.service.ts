import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AssignmentStatus,
  AuditAction,
  DeviceStatus,
  OfficerEmploymentStatus,
  PatrolAssignmentStatus,
  PatrolRouteStatus,
  Prisma,
} from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { UserRole as AppUserRole } from '../../common/enums/user-role.enum';
import { buildPaginationMeta } from '../../common/dto/pagination-meta.dto';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { hashRequestPayload } from '../../common/idempotency/request-hash.util';
import type { RequestUser } from '../../common/types/request-user.type';
import {
  requireOrganisationId,
  tenantNotFound,
  userHasPermission,
} from '../../common/tenant/tenant.util';
import {
  assertAllowedSortField,
  normalisePagination,
} from '../../common/utils/pagination.util';
import { trimOrUndefined } from '../../common/utils/normalize.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import type { ServiceRequestContext } from '../clients/clients.types';
import { ACTIVE_ATTENDANCE_STATUSES } from '../attendance/attendance-transitions.util';
import { PatrolAccessService } from '../patrols/patrol-access.service';
import { PatrolProgressService } from '../patrols/patrol-progress.service';
import {
  ACTIVE_PATROL_ASSIGNMENT_STATUSES,
  assertPatrolAssignmentTransition,
} from '../patrols/patrol-transitions.util';
import type { BatchCreatePatrolAssignmentsDto } from './dto/batch-create-patrol-assignments.dto';
import type { CancelPatrolAssignmentDto } from './dto/cancel-patrol-assignment.dto';
import type { CompletePatrolAssignmentDto } from './dto/complete-patrol-assignment.dto';
import type { CreatePatrolAssignmentDto } from './dto/create-patrol-assignment.dto';
import type { ListPatrolAssignmentsQueryDto } from './dto/list-patrol-assignments-query.dto';
import type { ListUpcomingPatrolAssignmentsQueryDto } from './dto/list-upcoming-patrol-assignments-query.dto';
import type { MarkMissedPatrolAssignmentDto } from './dto/mark-missed-patrol-assignment.dto';
import type { StartPatrolAssignmentDto } from './dto/start-patrol-assignment.dto';
import { toPatrolAssignmentResponse } from './mappers/patrol-assignment.mapper';

const ASSIGNMENT_SORT = [
  'createdAt',
  'scheduledStartAt',
  'status',
  'startedAt',
] as const;

const VALID_SHIFT_ASSIGNMENT_STATUSES: readonly AssignmentStatus[] = [
  AssignmentStatus.ASSIGNED,
  AssignmentStatus.CONFIRMED,
  AssignmentStatus.IN_PROGRESS,
];

const PATROL_INCLUDE = {
  patrolRoute: {
    select: {
      id: true,
      name: true,
      status: true,
      requireSequentialCompletion: true,
    },
  },
  site: {
    select: { id: true, name: true, code: true, status: true },
  },
  officer: {
    select: {
      id: true,
      officerNumber: true,
      employmentStatus: true,
      user: {
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  },
  shift: {
    select: {
      id: true,
      title: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
    },
  },
  checkpointSnapshots: { orderBy: { sequence: 'asc' as const } },
  visits: {
    select: {
      id: true,
      assignmentCheckpointId: true,
      status: true,
      patrolCheckpointId: true,
      visitedAtServer: true,
      latitude: true,
      longitude: true,
    },
    orderBy: { visitedAtServer: 'asc' as const },
  },
  events: {
    where: { reason: 'Patrol assignment created' },
    orderBy: { createdAt: 'asc' as const },
    take: 1,
    select: {
      actorUserId: true,
      createdAt: true,
      actorUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          employeeId: true,
          role: true,
        },
      },
    },
  },
} satisfies Prisma.PatrolAssignmentInclude;

@Injectable()
export class PatrolAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuthAuditService,
    private readonly configService: ConfigService,
    private readonly accessService: PatrolAccessService,
    private readonly progressService: PatrolProgressService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async create(
    user: RequestUser,
    dto: CreatePatrolAssignmentDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    if (user.role === AppUserRole.SUPERVISOR) {
      throw new AppException(
        'Only administrators can create patrol assignments',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      );
    }
    const created = await this.createOne(organisationId, user.id, dto, ctx);
    return this.toResponseWithProgress(created);
  }

  async createBatch(
    user: RequestUser,
    dto: BatchCreatePatrolAssignmentsDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    if (user.role === AppUserRole.SUPERVISOR) {
      throw new AppException(
        'Only administrators can create patrol assignments',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      );
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const rows = [];
      for (const item of dto.assignments) {
        rows.push(
          await this.createOneInTx(tx, organisationId, user.id, item, ctx),
        );
      }
      return rows;
    });
    return created.map((row) => this.toResponseWithProgress(row));
  }

  async findAll(user: RequestUser, query: ListPatrolAssignmentsQueryDto) {
    const organisationId = requireOrganisationId(user);
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const sortBy = assertAllowedSortField(
      query.sortBy,
      ASSIGNMENT_SORT,
      'createdAt',
    );
    const sortOrder = query.sortOrder ?? 'desc';

    let supervisorScope: Prisma.PatrolAssignmentWhereInput | undefined;
    if (user.role === AppUserRole.SUPERVISOR) {
      const supervisorProfileId =
        await this.accessService.resolveSupervisorProfileId(
          user,
          organisationId,
        );
      if (!supervisorProfileId) {
        supervisorScope = { officerId: { in: [] } };
      } else {
        const officerIds = await this.accessService.listAssignedOfficerIds(
          organisationId,
          supervisorProfileId,
        );

        if (query.officerId && !officerIds.includes(query.officerId)) {
          supervisorScope = { officerId: { in: [] } };
        } else {
          supervisorScope = {
            OR: [
              {
                officerId: query.officerId
                  ? query.officerId
                  : { in: officerIds },
              },
              { assignment: { supervisorId: supervisorProfileId } },
            ],
          };
        }
      }
    }

    const where: Prisma.PatrolAssignmentWhereInput = {
      organisationId,
      ...supervisorScope,
      ...(query.patrolRouteId ? { patrolRouteId: query.patrolRouteId } : {}),
      ...(query.assignmentId ? { assignmentId: query.assignmentId } : {}),
      ...(query.officerId && user.role !== AppUserRole.SUPERVISOR
        ? { officerId: query.officerId }
        : {}),
      ...(query.shiftId ? { shiftId: query.shiftId } : {}),
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.supervisorId && user.role !== AppUserRole.SUPERVISOR
        ? { assignment: { supervisorId: query.supervisorId } }
        : {}),
      ...(query.scheduledFrom || query.scheduledTo
        ? {
            scheduledStartAt: {
              ...(query.scheduledFrom
                ? { gte: new Date(query.scheduledFrom) }
                : {}),
              ...(query.scheduledTo
                ? { lte: new Date(query.scheduledTo) }
                : {}),
            },
          }
        : {}),
    };

    if (
      !userHasPermission(user, 'patrol-assignment:read') &&
      userHasPermission(user, 'patrol-assignment:read:self')
    ) {
      const officerId = await this.accessService.resolveOfficerProfileId(
        user,
        organisationId,
      );
      if (!officerId) {
        tenantNotFound(ErrorCode.PATROL_ASSIGNMENT_NOT_FOUND);
      }
      where.officerId = officerId;
    }

    const [items, total] = await Promise.all([
      this.prisma.patrolAssignment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy!]: sortOrder },
        include: PATROL_INCLUDE,
      }),
      this.prisma.patrolAssignment.count({ where }),
    ]);

    return {
      data: items.map((item) => this.toResponseWithProgress(item)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async current(user: RequestUser) {
    const organisationId = requireOrganisationId(user);
    const officerId = await this.accessService.resolveOfficerProfileId(
      user,
      organisationId,
    );
    if (!officerId) {
      tenantNotFound(ErrorCode.PATROL_ASSIGNMENT_NOT_FOUND);
    }

    const now = new Date();
    const patrol = await this.prisma.patrolAssignment.findFirst({
      where: {
        organisationId,
        officerId,
        status: {
          in: [
            PatrolAssignmentStatus.IN_PROGRESS,
            PatrolAssignmentStatus.REQUIRES_REVIEW,
            PatrolAssignmentStatus.NOT_STARTED,
          ],
        },
        OR: [
          { status: PatrolAssignmentStatus.IN_PROGRESS },
          { status: PatrolAssignmentStatus.REQUIRES_REVIEW },
          {
            status: PatrolAssignmentStatus.NOT_STARTED,
            OR: [
              { scheduledStartAt: null },
              { scheduledStartAt: { lte: now } },
            ],
          },
        ],
      },
      include: PATROL_INCLUDE,
      orderBy: [{ status: 'asc' }, { scheduledStartAt: 'asc' }],
    });

    if (!patrol) {
      return null;
    }
    return this.toResponseWithProgress(patrol);
  }

  async upcoming(
    user: RequestUser,
    query: ListUpcomingPatrolAssignmentsQueryDto,
  ) {
    const organisationId = requireOrganisationId(user);
    const officerId = await this.accessService.resolveOfficerProfileId(
      user,
      organisationId,
    );
    if (!officerId) {
      tenantNotFound(ErrorCode.PATROL_ASSIGNMENT_NOT_FOUND);
    }
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const now = new Date();

    const where: Prisma.PatrolAssignmentWhereInput = {
      organisationId,
      officerId,
      status: PatrolAssignmentStatus.NOT_STARTED,
      OR: [{ scheduledStartAt: null }, { scheduledStartAt: { gt: now } }],
    };

    const [items, total] = await Promise.all([
      this.prisma.patrolAssignment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledStartAt: 'asc' },
        include: PATROL_INCLUDE,
      }),
      this.prisma.patrolAssignment.count({ where }),
    ]);

    return {
      data: items.map((item) => this.toResponseWithProgress(item)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(user: RequestUser, id: string) {
    const organisationId = requireOrganisationId(user);
    const patrol = await this.findPatrolOrThrow(organisationId, id);
    await this.accessService.assertCanReadPatrolAssignment(
      user,
      organisationId,
      patrol,
    );
    return this.toResponseWithProgress(patrol);
  }

  async start(
    user: RequestUser,
    id: string,
    dto: StartPatrolAssignmentDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const ttl =
      this.configService.get<number>('patrol.idempotencyTtlSeconds') ?? 86_400;
    const requestHash = hashRequestPayload({
      patrolAssignmentId: id,
      deviceTimestamp: dto.deviceTimestamp,
    });

    const begin = await this.idempotencyService.begin({
      key: dto.idempotencyKey,
      organisationId,
      userId: user.id,
      operation: 'patrol.start',
      requestHash,
      ttlSeconds: ttl,
    });
    if (begin.replay && begin.record?.responseBody) {
      return begin.record.responseBody;
    }

    try {
      const response = await this.performStart(
        user,
        organisationId,
        id,
        dto,
        ctx,
      );
      await this.idempotencyService.complete(
        user.id,
        dto.idempotencyKey,
        200,
        response,
      );
      return response;
    } catch (error) {
      await this.idempotencyService.fail(
        user.id,
        dto.idempotencyKey,
        error instanceof Error ? error.message : 'patrol start failed',
      );
      throw error;
    }
  }

  async complete(
    user: RequestUser,
    id: string,
    dto: CompletePatrolAssignmentDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const ttl =
      this.configService.get<number>('patrol.idempotencyTtlSeconds') ?? 86_400;
    const requestHash = hashRequestPayload({
      patrolAssignmentId: id,
      deviceTimestamp: dto.deviceTimestamp,
      finalNote: dto.finalNote ?? null,
    });

    const begin = await this.idempotencyService.begin({
      key: dto.idempotencyKey,
      organisationId,
      userId: user.id,
      operation: 'patrol.complete',
      requestHash,
      ttlSeconds: ttl,
    });
    if (begin.replay && begin.record?.responseBody) {
      return begin.record.responseBody;
    }

    try {
      const response = await this.performComplete(
        user,
        organisationId,
        id,
        dto,
        ctx,
      );
      await this.idempotencyService.complete(
        user.id,
        dto.idempotencyKey,
        200,
        response,
      );
      return response;
    } catch (error) {
      await this.idempotencyService.fail(
        user.id,
        dto.idempotencyKey,
        error instanceof Error ? error.message : 'patrol complete failed',
      );
      throw error;
    }
  }

  async cancel(
    user: RequestUser,
    id: string,
    dto: CancelPatrolAssignmentDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findPatrolOrThrow(organisationId, id);
    assertPatrolAssignmentTransition(
      existing.status,
      PatrolAssignmentStatus.CANCELLED,
    );

    const reason = trimOrUndefined(dto.reason);
    if (!reason) {
      throw new AppException(
        'Cancellation reason is required',
        HttpStatus.BAD_REQUEST,
        ErrorCode.PATROL_ASSIGNMENT_STATUS_INVALID,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.patrolAssignment.update({
        where: { id: existing.id },
        data: {
          status: PatrolAssignmentStatus.CANCELLED,
          cancellationReason: reason,
          cancelledAt: new Date(),
          cancelledByUserId: user.id,
        },
        include: PATROL_INCLUDE,
      });
      await tx.patrolAssignmentEvent.create({
        data: {
          patrolAssignmentId: row.id,
          actorUserId: user.id,
          previousStatus: existing.status,
          newStatus: PatrolAssignmentStatus.CANCELLED,
          reason,
        },
      });
      return row;
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'PatrolAssignment',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { action: 'cancel' },
    });

    return this.toResponseWithProgress(updated);
  }

  async markMissed(
    user: RequestUser,
    id: string,
    dto: MarkMissedPatrolAssignmentDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findPatrolOrThrow(organisationId, id);
    assertPatrolAssignmentTransition(
      existing.status,
      PatrolAssignmentStatus.MISSED,
    );

    const reason = trimOrUndefined(dto.reason);
    if (!reason) {
      throw new AppException(
        'Missed reason is required',
        HttpStatus.BAD_REQUEST,
        ErrorCode.PATROL_ASSIGNMENT_STATUS_INVALID,
      );
    }

    const progress = this.progressService.calculate(
      existing.checkpointSnapshots ?? [],
      existing.visits ?? [],
    );
    const nextStatus =
      progress.completedCheckpoints > 0
        ? PatrolAssignmentStatus.PARTIALLY_COMPLETED
        : PatrolAssignmentStatus.MISSED;

    if (nextStatus === PatrolAssignmentStatus.PARTIALLY_COMPLETED) {
      assertPatrolAssignmentTransition(
        existing.status,
        PatrolAssignmentStatus.PARTIALLY_COMPLETED,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.patrolAssignment.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          completedAt: new Date(),
          completedCheckpointCount: progress.completedCheckpoints,
          totalCheckpointCount: progress.totalCheckpoints,
          finalNote: reason,
        },
        include: PATROL_INCLUDE,
      });
      await tx.patrolAssignmentEvent.create({
        data: {
          patrolAssignmentId: row.id,
          actorUserId: user.id,
          previousStatus: existing.status,
          newStatus: nextStatus,
          reason,
        },
      });
      return row;
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'PatrolAssignment',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { action: 'mark-missed', status: nextStatus },
    });

    return this.toResponseWithProgress(updated);
  }

  private async performStart(
    user: RequestUser,
    organisationId: string,
    id: string,
    dto: StartPatrolAssignmentDto,
    ctx: ServiceRequestContext,
  ) {
    const officerId = await this.accessService.resolveOfficerProfileId(
      user,
      organisationId,
    );
    if (!officerId) {
      tenantNotFound(ErrorCode.PATROL_ASSIGNMENT_NOT_FOUND);
    }

    const existing = await this.findPatrolOrThrow(organisationId, id);
    if (existing.officerId !== officerId) {
      tenantNotFound(ErrorCode.PATROL_ASSIGNMENT_NOT_FOUND);
    }

    if (existing.status === PatrolAssignmentStatus.IN_PROGRESS) {
      return this.toResponseWithProgress(existing);
    }

    assertPatrolAssignmentTransition(
      existing.status,
      PatrolAssignmentStatus.IN_PROGRESS,
    );

    const serverNow = new Date();
    const deviceTimestamp = new Date(dto.deviceTimestamp);
    this.assertDeviceTimeTolerance(deviceTimestamp, serverNow);
    await this.assertActiveDevice(user);
    await this.assertActiveAttendance(
      organisationId,
      officerId,
      existing.assignmentId,
    );
    this.assertStartWindow(existing, serverNow);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.patrolAssignment.update({
        where: { id: existing.id },
        data: {
          status: PatrolAssignmentStatus.IN_PROGRESS,
          startedAt: serverNow,
          startedAtDevice: deviceTimestamp,
        },
        include: PATROL_INCLUDE,
      });
      await tx.patrolAssignmentEvent.create({
        data: {
          patrolAssignmentId: row.id,
          actorUserId: user.id,
          previousStatus: existing.status,
          newStatus: PatrolAssignmentStatus.IN_PROGRESS,
          reason: 'Patrol started',
        },
      });
      return row;
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'PatrolAssignment',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { action: 'start' },
    });

    return this.toResponseWithProgress(updated);
  }

  private async performComplete(
    user: RequestUser,
    organisationId: string,
    id: string,
    dto: CompletePatrolAssignmentDto,
    ctx: ServiceRequestContext,
  ) {
    const officerId = await this.accessService.resolveOfficerProfileId(
      user,
      organisationId,
    );
    if (!officerId) {
      tenantNotFound(ErrorCode.PATROL_ASSIGNMENT_NOT_FOUND);
    }

    const existing = await this.findPatrolOrThrow(organisationId, id);
    if (existing.officerId !== officerId) {
      tenantNotFound(ErrorCode.PATROL_ASSIGNMENT_NOT_FOUND);
    }

    if (
      existing.status === PatrolAssignmentStatus.COMPLETED ||
      existing.status === PatrolAssignmentStatus.PARTIALLY_COMPLETED
    ) {
      return this.toResponseWithProgress(existing);
    }

    const serverNow = new Date();
    const deviceTimestamp = new Date(dto.deviceTimestamp);
    this.assertDeviceTimeTolerance(deviceTimestamp, serverNow);
    await this.assertActiveDevice(user);

    const progress = this.progressService.calculate(
      existing.checkpointSnapshots ?? [],
      existing.visits ?? [],
    );

    let nextStatus: PatrolAssignmentStatus;
    if (progress.allRequiredComplete) {
      nextStatus = PatrolAssignmentStatus.COMPLETED;
    } else if (progress.completedCheckpoints > 0) {
      const note = trimOrUndefined(dto.finalNote);
      if (!note) {
        throw new AppException(
          'Final note is required for partial completion',
          HttpStatus.CONFLICT,
          ErrorCode.PATROL_ASSIGNMENT_NOT_COMPLETE,
        );
      }
      nextStatus = PatrolAssignmentStatus.PARTIALLY_COMPLETED;
    } else {
      throw new AppException(
        'Patrol has no completed checkpoints',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_ASSIGNMENT_NOT_COMPLETE,
      );
    }

    assertPatrolAssignmentTransition(existing.status, nextStatus);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.patrolAssignment.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          completedAt: serverNow,
          completedAtDevice: deviceTimestamp,
          completedCheckpointCount: progress.completedCheckpoints,
          totalCheckpointCount: progress.totalCheckpoints,
          finalNote: trimOrUndefined(dto.finalNote) ?? null,
        },
        include: PATROL_INCLUDE,
      });
      await tx.patrolAssignmentEvent.create({
        data: {
          patrolAssignmentId: row.id,
          actorUserId: user.id,
          previousStatus: existing.status,
          newStatus: nextStatus,
          reason: trimOrUndefined(dto.finalNote) ?? 'Patrol completed',
        },
      });
      return row;
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'PatrolAssignment',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { action: 'complete', status: nextStatus },
    });

    return this.toResponseWithProgress(updated);
  }

  private async createOne(
    organisationId: string,
    actorUserId: string,
    dto: CreatePatrolAssignmentDto,
    ctx: ServiceRequestContext,
  ) {
    return this.prisma.$transaction(async (tx) =>
      this.createOneInTx(tx, organisationId, actorUserId, dto, ctx),
    );
  }

  private async createOneInTx(
    tx: Prisma.TransactionClient,
    organisationId: string,
    actorUserId: string,
    dto: CreatePatrolAssignmentDto,
    ctx: ServiceRequestContext,
  ) {
    const route = await tx.patrolRoute.findFirst({
      where: {
        id: dto.patrolRouteId,
        organisationId,
        deletedAt: null,
      },
      include: {
        checkpoints: {
          where: { deletedAt: null, active: true },
          orderBy: { sequence: 'asc' },
        },
      },
    });
    if (!route) {
      tenantNotFound(ErrorCode.PATROL_ROUTE_NOT_FOUND);
    }
    if (route.status !== PatrolRouteStatus.ACTIVE) {
      throw new AppException(
        'Patrol route is not active',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_ASSIGNMENT_ROUTE_INACTIVE,
      );
    }
    if (route.checkpoints.length === 0) {
      throw new AppException(
        'Route has no active checkpoints',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_ROUTE_HAS_NO_CHECKPOINTS,
      );
    }

    const shiftAssignment = await tx.assignment.findFirst({
      where: { id: dto.assignmentId, organisationId },
      include: {
        officer: { select: { id: true, employmentStatus: true } },
        shift: true,
      },
    });
    if (!shiftAssignment) {
      tenantNotFound(ErrorCode.ASSIGNMENT_NOT_FOUND);
    }
    if (!VALID_SHIFT_ASSIGNMENT_STATUSES.includes(shiftAssignment.status)) {
      throw new AppException(
        'Shift assignment is not valid for patrol creation',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_ASSIGNMENT_SHIFT_INVALID,
      );
    }
    if (
      shiftAssignment.officer.employmentStatus !==
      OfficerEmploymentStatus.ACTIVE
    ) {
      throw new AppException(
        'Officer is not active',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_ASSIGNMENT_SHIFT_INVALID,
      );
    }
    if (shiftAssignment.shift.siteId !== route.siteId) {
      throw new AppException(
        'Patrol route site does not match shift assignment site',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_ASSIGNMENT_SITE_MISMATCH,
      );
    }

    const duplicate = await tx.patrolAssignment.findFirst({
      where: {
        organisationId,
        patrolRouteId: route.id,
        assignmentId: shiftAssignment.id,
        status: { in: [...ACTIVE_PATROL_ASSIGNMENT_STATUSES] },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppException(
        'An active patrol assignment already exists for this route and shift',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_ASSIGNMENT_DUPLICATE,
      );
    }

    const scheduledStartAt = dto.scheduledStartAt
      ? new Date(dto.scheduledStartAt)
      : null;
    const scheduledEndAt = dto.scheduledEndAt
      ? new Date(dto.scheduledEndAt)
      : null;
    if (
      scheduledStartAt &&
      scheduledEndAt &&
      scheduledEndAt <= scheduledStartAt
    ) {
      throw new AppException(
        'scheduledEndAt must be after scheduledStartAt',
        HttpStatus.BAD_REQUEST,
        ErrorCode.PATROL_ASSIGNMENT_SHIFT_INVALID,
      );
    }

    const patrol = await tx.patrolAssignment.create({
      data: {
        organisationId,
        patrolRouteId: route.id,
        assignmentId: shiftAssignment.id,
        officerId: shiftAssignment.officerId,
        shiftId: shiftAssignment.shiftId,
        siteId: route.siteId,
        scheduledStartAt,
        scheduledEndAt,
        status: PatrolAssignmentStatus.NOT_STARTED,
        completedCheckpointCount: 0,
        totalCheckpointCount: route.checkpoints.length,
        checkpointSnapshots: {
          create: route.checkpoints.map((cp) => ({
            organisationId,
            sourceCheckpointId: cp.id,
            name: cp.name,
            description: cp.description,
            sequence: cp.sequence,
            latitude: cp.latitude,
            longitude: cp.longitude,
            allowedRadiusMeters: cp.allowedRadiusMeters,
            verificationMethod: cp.verificationMethod,
            qrCodeHash: cp.qrCodeHash,
            requiresPhoto: cp.requiresPhoto,
            requiresNote: cp.requiresNote,
            instructions: cp.instructions,
            minimumGpsAccuracyMeters: cp.minimumGpsAccuracyMeters,
          })),
        },
        events: {
          create: {
            actorUserId,
            previousStatus: null,
            newStatus: PatrolAssignmentStatus.NOT_STARTED,
            reason: 'Patrol assignment created',
          },
        },
      },
      include: PATROL_INCLUDE,
    });

    await this.auditService.record({
      organisationId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: 'PatrolAssignment',
      entityId: patrol.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return patrol;
  }

  private toResponseWithProgress(
    assignment: Prisma.PatrolAssignmentGetPayload<{
      include: typeof PATROL_INCLUDE;
    }>,
  ) {
    const progress = this.progressService.calculate(
      assignment.checkpointSnapshots,
      assignment.visits,
    );
    return toPatrolAssignmentResponse(assignment, progress);
  }

  private async findPatrolOrThrow(organisationId: string, id: string) {
    const patrol = await this.prisma.patrolAssignment.findFirst({
      where: { id, organisationId },
      include: PATROL_INCLUDE,
    });
    if (!patrol) {
      tenantNotFound(ErrorCode.PATROL_ASSIGNMENT_NOT_FOUND);
    }
    return patrol;
  }

  private assertDeviceTimeTolerance(
    deviceTimestamp: Date,
    serverNow: Date,
  ): void {
    const toleranceMinutes =
      this.configService.get<number>('patrol.deviceTimeToleranceMinutes') ?? 10;
    const diffMs = Math.abs(deviceTimestamp.getTime() - serverNow.getTime());
    if (diffMs > toleranceMinutes * 60_000) {
      throw new AppException(
        'Device timestamp is outside the allowed tolerance',
        HttpStatus.BAD_REQUEST,
        ErrorCode.PATROL_VISIT_DEVICE_TIME_INVALID,
      );
    }
  }

  private async assertActiveDevice(user: RequestUser): Promise<void> {
    if (!user.deviceId) {
      throw new AppException(
        'Active device is required',
        HttpStatus.FORBIDDEN,
        ErrorCode.DEVICE_NOT_ACTIVE,
      );
    }
    const device = await this.prisma.device.findFirst({
      where: { id: user.deviceId },
      select: { status: true },
    });
    if (!device || device.status !== DeviceStatus.ACTIVE) {
      throw new AppException(
        'Device is not active',
        HttpStatus.FORBIDDEN,
        ErrorCode.DEVICE_NOT_ACTIVE,
      );
    }
  }

  private async assertActiveAttendance(
    organisationId: string,
    officerId: string,
    assignmentId: string,
  ): Promise<void> {
    const attendance = await this.prisma.attendance.findFirst({
      where: {
        organisationId,
        officerId,
        assignmentId,
        deletedAt: null,
        status: { in: [...ACTIVE_ATTENDANCE_STATUSES] },
      },
      select: { id: true },
    });
    if (!attendance) {
      throw new AppException(
        'Active attendance is required to start a patrol',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_ASSIGNMENT_ATTENDANCE_REQUIRED,
      );
    }
  }

  private assertStartWindow(
    patrol: {
      scheduledStartAt: Date | null;
      scheduledEndAt: Date | null;
    },
    serverNow: Date,
  ): void {
    if (!patrol.scheduledStartAt) {
      return;
    }
    const earlyMinutes =
      this.configService.get<number>('patrol.startEarlyMinutes') ?? 15;
    const lateMinutes =
      this.configService.get<number>('patrol.startLateMinutes') ?? 30;
    const earliest = new Date(
      patrol.scheduledStartAt.getTime() - earlyMinutes * 60_000,
    );
    const latestBase = patrol.scheduledEndAt ?? patrol.scheduledStartAt;
    const latest = new Date(latestBase.getTime() + lateMinutes * 60_000);

    if (serverNow < earliest || serverNow > latest) {
      throw new AppException(
        'Patrol start is outside the allowed time window',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_ASSIGNMENT_NOT_CURRENT,
      );
    }
  }
}
