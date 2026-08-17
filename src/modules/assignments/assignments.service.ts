import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AssignmentStatus,
  AuditAction,
  OfficerEmploymentStatus,
  Prisma,
  RecurrenceType,
  ShiftStatus,
  SiteStatus,
} from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { UserRole as AppUserRole } from '../../common/enums/user-role.enum';
import { buildPaginationMeta } from '../../common/dto/pagination-meta.dto';
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
import { AssignmentAccessService } from './assignment-access.service';
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  assertAssignmentTransition,
} from './assignment-transitions.util';
import { rangesOverlap } from './assignment-overlap.util';
import type { BatchCreateAssignmentsDto } from './dto/batch-create-assignments.dto';
import type { CreateAssignmentDto } from './dto/create-assignment.dto';
import type { ListAssignmentsQueryDto } from './dto/list-assignments-query.dto';
import type { ListUpcomingAssignmentsQueryDto } from './dto/list-upcoming-assignments-query.dto';
import type { ReassignAssignmentDto } from './dto/reassign-assignment.dto';
import type { UpdateAssignmentStatusDto } from './dto/update-assignment-status.dto';
import { toAssignmentResponse } from './mappers/assignment.mapper';
import {
  expandOccurrences,
  isRecurringShift,
  recurrencesOverlap,
  resolveActiveOrUpcomingToday,
  type ShiftRecurrenceInput,
} from '../shifts/shift-recurrence.util';

const ASSIGNMENT_SORT_FIELDS = [
  'assignedAt',
  'confirmedAt',
  'status',
  'createdAt',
] as const;

const ASSIGNMENT_INCLUDE = {
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      employeeId: true,
      role: true,
    },
  },
  officer: {
    select: {
      id: true,
      officerNumber: true,
      employmentStatus: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeId: true,
        },
      },
    },
  },
  supervisor: {
    select: {
      id: true,
      supervisorNumber: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeId: true,
        },
      },
    },
  },
  shift: {
    select: {
      id: true,
      title: true,
      status: true,
      siteId: true,
      gracePeriodMinutes: true,
      unpaidBreakMinutes: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      recurrenceType: true,
      recurrenceEndAt: true,
      recurrenceDaysOfWeek: true,
      timezone: true,
      organisation: {
        select: { timezone: true },
      },
      site: {
        select: {
          id: true,
          clientId: true,
          name: true,
          code: true,
          address: true,
          latitude: true,
          longitude: true,
          clockInRadiusMeters: true,
          clockOutRadiusMeters: true,
          checkpointDefaultRadiusMeters: true,
          minimumGpsAccuracyMeters: true,
          clockInOutsideGeofencePolicy: true,
          clockOutOutsideGeofencePolicy: true,
          requiresClockInSelfie: true,
          requiresClockOutSelfie: true,
          requiresPatrol: true,
          requiresFinalShiftNote: true,
          instructions: true,
          status: true,
        },
      },
    },
  },
} satisfies Prisma.AssignmentInclude;

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuthAuditService,
    private readonly accessService: AssignmentAccessService,
    private readonly configService: ConfigService,
  ) {}

  async create(
    user: RequestUser,
    dto: CreateAssignmentDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);

    const supervisorId = dto.supervisorId ?? null;
    if (user.role === AppUserRole.SUPERVISOR) {
      throw new AppException(
        'Only administrators can create assignments. Supervisors can view assignments for their team.',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const shift = await this.loadAssignableShift(
        tx,
        organisationId,
        dto.shiftId,
      );
      await this.assertOfficerAssignable(tx, organisationId, dto.officerId);
      if (supervisorId) {
        await this.assertSupervisorAssignable(tx, organisationId, supervisorId);
      }

      await this.assertNoDuplicate(
        tx,
        organisationId,
        dto.shiftId,
        dto.officerId,
      );
      await this.assertNoOverlap(tx, organisationId, dto.officerId, shift);

      const assignment = await tx.assignment.create({
        data: {
          organisationId,
          shiftId: dto.shiftId,
          officerId: dto.officerId,
          supervisorId,
          notes: trimOrUndefined(dto.notes) ?? null,
          status: AssignmentStatus.ASSIGNED,
          createdByUserId: user.id,
        },
        include: ASSIGNMENT_INCLUDE,
      });

      await tx.assignmentEvent.create({
        data: {
          assignmentId: assignment.id,
          actorUserId: user.id,
          previousStatus: null,
          newStatus: AssignmentStatus.ASSIGNED,
          reason: 'Assignment created',
        },
      });

      return assignment;
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      entityType: 'Assignment',
      entityId: created.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        shiftId: created.shiftId,
        officerId: created.officerId,
        supervisorId: created.supervisorId,
      },
    });

    return this.toResponse(created);
  }

  async createBatch(
    user: RequestUser,
    dto: BatchCreateAssignmentsDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const uniqueOfficerIds = [...new Set(dto.officerIds)];

    const supervisorId = dto.supervisorId ?? null;
    if (user.role === AppUserRole.SUPERVISOR) {
      throw new AppException(
        'Only administrators can create assignments. Supervisors can view assignments for their team.',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const shift = await this.loadAssignableShift(
        tx,
        organisationId,
        dto.shiftId,
      );
      if (supervisorId) {
        await this.assertSupervisorAssignable(tx, organisationId, supervisorId);
      }

      for (const officerId of uniqueOfficerIds) {
        await this.assertOfficerAssignable(tx, organisationId, officerId);
        await this.assertNoDuplicate(
          tx,
          organisationId,
          dto.shiftId,
          officerId,
        );
        await this.assertNoOverlap(tx, organisationId, officerId, shift);
      }

      const results = [];
      for (const officerId of uniqueOfficerIds) {
        const assignment = await tx.assignment.create({
          data: {
            organisationId,
            shiftId: dto.shiftId,
            officerId,
            supervisorId,
            status: AssignmentStatus.ASSIGNED,
            createdByUserId: user.id,
          },
          include: ASSIGNMENT_INCLUDE,
        });
        await tx.assignmentEvent.create({
          data: {
            assignmentId: assignment.id,
            actorUserId: user.id,
            previousStatus: null,
            newStatus: AssignmentStatus.ASSIGNED,
            reason: 'Batch assignment created',
          },
        });
        results.push(assignment);
      }
      return results;
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      entityType: 'Assignment',
      entityId: created[0]?.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        batch: true,
        count: created.length,
        shiftId: dto.shiftId,
        supervisorId,
      },
    });

    return { data: created.map((a) => this.toResponse(a)) };
  }

  async findAll(user: RequestUser, query: ListAssignmentsQueryDto) {
    const organisationId = requireOrganisationId(user);
    if (!userHasPermission(user, 'assignment:read')) {
      throw new AppException(
        'Insufficient permissions',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      );
    }

    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const sortBy = assertAllowedSortField(
      query.sortBy,
      ASSIGNMENT_SORT_FIELDS,
      'assignedAt',
    );
    const sortOrder = query.sortOrder ?? 'desc';

    let supervisorScope: Prisma.AssignmentWhereInput | undefined;
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
          const scopedOfficerId = query.officerId
            ? query.officerId
            : { in: officerIds };
          supervisorScope = {
            OR: [
              { supervisorId: supervisorProfileId },
              { officerId: scopedOfficerId },
            ],
          };
        }
      }
    }

    const where: Prisma.AssignmentWhereInput = {
      organisationId,
      ...supervisorScope,
      ...(query.officerId && user.role !== AppUserRole.SUPERVISOR
        ? { officerId: query.officerId }
        : {}),
      ...(query.supervisorId && user.role !== AppUserRole.SUPERVISOR
        ? { supervisorId: query.supervisorId }
        : {}),
      ...(query.shiftId ? { shiftId: query.shiftId } : {}),
      ...(query.siteId ? { shift: { siteId: query.siteId } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.scheduledFrom || query.scheduledTo
        ? {
            shift: {
              ...(query.siteId ? { siteId: query.siteId } : {}),
              scheduledStartAt: {
                ...(query.scheduledFrom
                  ? { gte: new Date(query.scheduledFrom) }
                  : {}),
                ...(query.scheduledTo
                  ? { lte: new Date(query.scheduledTo) }
                  : {}),
              },
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.assignment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy!]: sortOrder },
        include: ASSIGNMENT_INCLUDE,
      }),
      this.prisma.assignment.count({ where }),
    ]);

    return {
      data: items.map((a) => this.toResponse(a)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findCurrent(user: RequestUser) {
    const organisationId = requireOrganisationId(user);
    const officerId = await this.accessService.resolveOfficerProfileId(
      user,
      organisationId,
    );
    const now = new Date();
    const earlyMs = 2 * 60 * 60_000;

    const candidates = await this.prisma.assignment.findMany({
      where: {
        organisationId,
        officerId,
        isActive: true,
        status: {
          in: [
            AssignmentStatus.ASSIGNED,
            AssignmentStatus.CONFIRMED,
            AssignmentStatus.IN_PROGRESS,
          ],
        },
        shift: { deletedAt: null },
      },
      include: ASSIGNMENT_INCLUDE,
      orderBy: { shift: { scheduledStartAt: 'asc' } },
    });

    const inProgress = candidates.find(
      (assignment) =>
        assignment.status === AssignmentStatus.IN_PROGRESS && assignment.shift,
    );
    if (inProgress) {
      const occurrence = this.occurrenceFor(inProgress, now, earlyMs);
      return this.toResponse(inProgress, occurrence);
    }

    for (const assignment of candidates) {
      const occurrence = this.occurrenceFor(assignment, now, earlyMs);
      if (occurrence) {
        return this.toResponse(assignment, occurrence);
      }
    }

    return null;
  }

  async findUpcoming(
    user: RequestUser,
    query: ListUpcomingAssignmentsQueryDto,
  ) {
    const organisationId = requireOrganisationId(user);
    const officerId = await this.accessService.resolveOfficerProfileId(
      user,
      organisationId,
    );
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const from = query.from ? new Date(query.from) : new Date();
    const to = query.to
      ? new Date(query.to)
      : new Date(from.getTime() + 14 * 24 * 60 * 60_000);

    const candidates = await this.prisma.assignment.findMany({
      where: {
        organisationId,
        officerId,
        isActive: true,
        status: {
          in: [
            AssignmentStatus.ASSIGNED,
            AssignmentStatus.CONFIRMED,
            AssignmentStatus.IN_PROGRESS,
          ],
        },
        shift: {
          deletedAt: null,
          OR: [
            {
              recurrenceType: RecurrenceType.NONE,
              scheduledEndAt: { gte: from },
              scheduledStartAt: { lte: to },
            },
            {
              recurrenceType: { not: RecurrenceType.NONE },
              scheduledStartAt: { lte: to },
              OR: [
                { recurrenceEndAt: null },
                { recurrenceEndAt: { gte: from } },
              ],
            },
          ],
        },
      },
      include: ASSIGNMENT_INCLUDE,
      orderBy: { shift: { scheduledStartAt: 'asc' } },
    });

    const expanded = candidates.flatMap((assignment) => {
      const occurrences = expandOccurrences(
        this.toRecurrenceInput(assignment),
        from,
        to,
        31,
      );
      return occurrences.map((occurrence) => ({ assignment, occurrence }));
    });
    expanded.sort(
      (a, b) => a.occurrence.startAt.getTime() - b.occurrence.startAt.getTime(),
    );

    const pageItems = expanded.slice(skip, skip + limit);
    return {
      data: pageItems.map((item) =>
        this.toResponse(item.assignment, item.occurrence),
      ),
      meta: buildPaginationMeta(page, limit, expanded.length),
    };
  }

  async findHistory(user: RequestUser, query: ListUpcomingAssignmentsQueryDto) {
    const organisationId = requireOrganisationId(user);
    const officerId = await this.accessService.resolveOfficerProfileId(
      user,
      organisationId,
    );
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const now = new Date();
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    const where: Prisma.AssignmentWhereInput = {
      organisationId,
      officerId,
      shift: {
        deletedAt: null,
        ...(from || to
          ? {
              scheduledStartAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      OR: [
        {
          status: {
            in: [
              AssignmentStatus.COMPLETED,
              AssignmentStatus.CANCELLED,
              AssignmentStatus.MISSED,
              AssignmentStatus.REASSIGNED,
            ],
          },
        },
        {
          status: {
            in: [
              AssignmentStatus.ASSIGNED,
              AssignmentStatus.CONFIRMED,
              AssignmentStatus.IN_PROGRESS,
            ],
          },
          shift: { scheduledEndAt: { lt: now }, deletedAt: null },
        },
      ],
    };

    const [items, total] = await Promise.all([
      this.prisma.assignment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { shift: { scheduledStartAt: 'desc' } },
        include: ASSIGNMENT_INCLUDE,
      }),
      this.prisma.assignment.count({ where }),
    ]);

    return {
      data: items.map((a) => this.toResponse(a)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(user: RequestUser, id: string) {
    const organisationId = requireOrganisationId(user);
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, organisationId },
      include: ASSIGNMENT_INCLUDE,
    });
    if (!assignment) {
      tenantNotFound(ErrorCode.ASSIGNMENT_NOT_FOUND);
    }

    await this.accessService.assertCanReadAssignment(
      user,
      organisationId,
      assignment,
    );

    return this.toResponse(assignment);
  }

  async updateStatus(
    user: RequestUser,
    id: string,
    dto: UpdateAssignmentStatusDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findAssignmentOrThrow(organisationId, id);
    await this.accessService.assertCanReadAssignment(
      user,
      organisationId,
      existing,
    );
    assertAssignmentTransition(existing.status, dto.status);

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.assignment.update({
        where: { id: existing.id },
        data: {
          status: dto.status,
          ...(dto.status === AssignmentStatus.CONFIRMED
            ? { confirmedAt: now }
            : {}),
          ...(dto.status === AssignmentStatus.IN_PROGRESS
            ? { startedAt: now }
            : {}),
          ...(dto.status === AssignmentStatus.COMPLETED
            ? { completedAt: now }
            : {}),
          ...(dto.status === AssignmentStatus.CANCELLED ||
          dto.status === AssignmentStatus.MISSED
            ? {
                cancelledAt: now,
                cancellationReason: trimOrUndefined(dto.reason) ?? null,
              }
            : {}),
        },
        include: ASSIGNMENT_INCLUDE,
      });

      await tx.assignmentEvent.create({
        data: {
          assignmentId: assignment.id,
          actorUserId: user.id,
          previousStatus: existing.status,
          newStatus: dto.status,
          reason: trimOrUndefined(dto.reason) ?? null,
        },
      });

      return assignment;
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'Assignment',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        previousStatus: existing.status,
        newStatus: dto.status,
      },
    });

    return this.toResponse(updated);
  }

  async confirm(user: RequestUser, id: string, ctx: ServiceRequestContext) {
    const organisationId = requireOrganisationId(user);
    const officerId = await this.accessService.resolveOfficerProfileId(
      user,
      organisationId,
    );
    const existing = await this.findAssignmentOrThrow(organisationId, id);

    if (existing.officerId !== officerId) {
      tenantNotFound(ErrorCode.ASSIGNMENT_NOT_FOUND);
    }
    if (existing.status !== AssignmentStatus.ASSIGNED) {
      throw new AppException(
        'Only ASSIGNED assignments can be confirmed',
        HttpStatus.CONFLICT,
        ErrorCode.ASSIGNMENT_STATUS_TRANSITION_INVALID,
      );
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.assignment.update({
        where: { id: existing.id },
        data: {
          status: AssignmentStatus.CONFIRMED,
          confirmedAt: now,
        },
        include: ASSIGNMENT_INCLUDE,
      });
      await tx.assignmentEvent.create({
        data: {
          assignmentId: assignment.id,
          actorUserId: user.id,
          previousStatus: AssignmentStatus.ASSIGNED,
          newStatus: AssignmentStatus.CONFIRMED,
          reason: 'Officer confirmed assignment',
        },
      });
      return assignment;
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'Assignment',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { action: 'confirm' },
    });

    return this.toResponse(updated);
  }

  async reassign(
    user: RequestUser,
    id: string,
    dto: ReassignAssignmentDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findAssignmentOrThrow(organisationId, id);
    await this.accessService.assertCanReadAssignment(
      user,
      organisationId,
      existing,
    );
    if (user.role === AppUserRole.SUPERVISOR) {
      await this.accessService.assertSupervisorMayManageOfficer(
        user,
        organisationId,
        dto.replacementOfficerId,
      );
    }

    if (
      existing.status !== AssignmentStatus.ASSIGNED &&
      existing.status !== AssignmentStatus.CONFIRMED
    ) {
      throw new AppException(
        'Only ASSIGNED or CONFIRMED assignments can be reassigned',
        HttpStatus.CONFLICT,
        ErrorCode.ASSIGNMENT_STATUS_TRANSITION_INVALID,
      );
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const shift = await this.loadAssignableShift(
        tx,
        organisationId,
        existing.shiftId,
        true,
      );
      await this.assertOfficerAssignable(
        tx,
        organisationId,
        dto.replacementOfficerId,
      );
      const supervisorId = dto.supervisorId ?? existing.supervisorId;
      if (supervisorId) {
        await this.assertSupervisorAssignable(tx, organisationId, supervisorId);
      }

      await this.assertNoDuplicate(
        tx,
        organisationId,
        existing.shiftId,
        dto.replacementOfficerId,
      );
      await this.assertNoOverlap(
        tx,
        organisationId,
        dto.replacementOfficerId,
        shift,
        existing.id,
      );

      const original = await tx.assignment.update({
        where: { id: existing.id },
        data: {
          status: AssignmentStatus.REASSIGNED,
          cancelledAt: now,
          cancellationReason: dto.reason.trim(),
        },
        include: ASSIGNMENT_INCLUDE,
      });
      await tx.assignmentEvent.create({
        data: {
          assignmentId: original.id,
          actorUserId: user.id,
          previousStatus: existing.status,
          newStatus: AssignmentStatus.REASSIGNED,
          reason: dto.reason.trim(),
        },
      });

      const replacement = await tx.assignment.create({
        data: {
          organisationId,
          shiftId: existing.shiftId,
          officerId: dto.replacementOfficerId,
          supervisorId,
          status: AssignmentStatus.ASSIGNED,
          replacedAssignmentId: original.id,
          createdByUserId: user.id,
        },
        include: ASSIGNMENT_INCLUDE,
      });
      await tx.assignmentEvent.create({
        data: {
          assignmentId: replacement.id,
          actorUserId: user.id,
          previousStatus: null,
          newStatus: AssignmentStatus.ASSIGNED,
          reason: `Reassigned from ${original.id}`,
        },
      });

      return { original, replacement };
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'Assignment',
      entityId: result.original.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        action: 'reassign',
        replacementId: result.replacement.id,
      },
    });

    return {
      original: this.toResponse(result.original),
      replacement: this.toResponse(result.replacement),
    };
  }

  async cancel(user: RequestUser, id: string, ctx: ServiceRequestContext) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findAssignmentOrThrow(organisationId, id);
    await this.accessService.assertCanReadAssignment(
      user,
      organisationId,
      existing,
    );

    if (
      existing.status === AssignmentStatus.IN_PROGRESS ||
      existing.status === AssignmentStatus.COMPLETED
    ) {
      throw new AppException(
        'Started assignments cannot be cancelled via delete',
        HttpStatus.CONFLICT,
        ErrorCode.ASSIGNMENT_STATUS_TRANSITION_INVALID,
      );
    }

    if (
      existing.status === AssignmentStatus.CANCELLED ||
      existing.status === AssignmentStatus.REASSIGNED ||
      existing.status === AssignmentStatus.MISSED
    ) {
      return;
    }

    assertAssignmentTransition(existing.status, AssignmentStatus.CANCELLED);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id: existing.id },
        data: {
          status: AssignmentStatus.CANCELLED,
          cancelledAt: now,
          cancellationReason: 'Cancelled by administrator',
        },
      });
      await tx.assignmentEvent.create({
        data: {
          assignmentId: existing.id,
          actorUserId: user.id,
          previousStatus: existing.status,
          newStatus: AssignmentStatus.CANCELLED,
          reason: 'Cancelled by administrator',
        },
      });
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.DELETE,
      entityType: 'Assignment',
      entityId: existing.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { softCancel: true },
    });
  }

  private async findAssignmentOrThrow(organisationId: string, id: string) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, organisationId },
      include: ASSIGNMENT_INCLUDE,
    });
    if (!assignment) {
      tenantNotFound(ErrorCode.ASSIGNMENT_NOT_FOUND);
    }
    return assignment;
  }

  private async loadAssignableShift(
    tx: Prisma.TransactionClient,
    organisationId: string,
    shiftId: string,
    allowInProgress = false,
  ) {
    const shift = await tx.shift.findFirst({
      where: { id: shiftId, organisationId, deletedAt: null },
      include: {
        site: { select: { id: true, status: true, deletedAt: true } },
        organisation: { select: { timezone: true } },
      },
    });
    if (!shift) {
      tenantNotFound(ErrorCode.SHIFT_NOT_FOUND);
    }

    const allowed: ShiftStatus[] = allowInProgress
      ? [ShiftStatus.DRAFT, ShiftStatus.SCHEDULED, ShiftStatus.IN_PROGRESS]
      : [ShiftStatus.DRAFT, ShiftStatus.SCHEDULED];

    if (!allowed.includes(shift.status)) {
      throw new AppException(
        'Shift is not assignable in its current status',
        HttpStatus.CONFLICT,
        ErrorCode.ASSIGNMENT_SHIFT_INVALID,
      );
    }

    if (
      !shift.site ||
      shift.site.deletedAt ||
      shift.site.status !== SiteStatus.ACTIVE
    ) {
      throw new AppException(
        'Site is not active for assignment',
        HttpStatus.CONFLICT,
        ErrorCode.SHIFT_SITE_INACTIVE,
      );
    }

    return shift;
  }

  private async assertOfficerAssignable(
    tx: Prisma.TransactionClient,
    organisationId: string,
    officerId: string,
  ) {
    const officer = await tx.officerProfile.findFirst({
      where: { id: officerId, organisationId, deletedAt: null },
      select: { id: true, employmentStatus: true },
    });
    if (!officer) {
      tenantNotFound(ErrorCode.OFFICER_NOT_FOUND);
    }
    if (officer.employmentStatus !== OfficerEmploymentStatus.ACTIVE) {
      throw new AppException(
        'Officer is not active',
        HttpStatus.CONFLICT,
        ErrorCode.ASSIGNMENT_OFFICER_INACTIVE,
      );
    }
  }

  private async assertSupervisorAssignable(
    tx: Prisma.TransactionClient,
    organisationId: string,
    supervisorId: string,
  ) {
    const supervisor = await tx.supervisorProfile.findFirst({
      where: { id: supervisorId, organisationId, deletedAt: null },
      select: { id: true, user: { select: { status: true } } },
    });
    if (!supervisor) {
      throw new AppException(
        'Supervisor is invalid for this organisation',
        HttpStatus.BAD_REQUEST,
        ErrorCode.ASSIGNMENT_SUPERVISOR_INVALID,
      );
    }
  }

  private async assertNoDuplicate(
    tx: Prisma.TransactionClient,
    organisationId: string,
    shiftId: string,
    officerId: string,
  ) {
    const existing = await tx.assignment.findFirst({
      where: {
        organisationId,
        shiftId,
        officerId,
        status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] },
      },
      select: { id: true },
    });
    if (existing) {
      throw new AppException(
        'Officer already has an active assignment for this shift',
        HttpStatus.CONFLICT,
        ErrorCode.ASSIGNMENT_DUPLICATE,
      );
    }
  }

  private async assertNoOverlap(
    tx: Prisma.TransactionClient,
    organisationId: string,
    officerId: string,
    proposedShift: {
      scheduledStartAt: Date;
      scheduledEndAt: Date;
      recurrenceType?: RecurrenceType | null;
      recurrenceEndAt?: Date | null;
      recurrenceDaysOfWeek?: number[] | null;
      timezone?: string | null;
      organisation?: { timezone: string } | null;
    },
    ignoreAssignmentId?: string,
  ) {
    const others = await tx.assignment.findMany({
      where: {
        organisationId,
        officerId,
        isActive: true,
        status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] },
        ...(ignoreAssignmentId ? { id: { not: ignoreAssignmentId } } : {}),
        shift: { deletedAt: null },
      },
      include: {
        shift: {
          select: {
            scheduledStartAt: true,
            scheduledEndAt: true,
            recurrenceType: true,
            recurrenceEndAt: true,
            recurrenceDaysOfWeek: true,
            timezone: true,
            organisation: { select: { timezone: true } },
          },
        },
      },
    });

    const windowStart = proposedShift.scheduledStartAt;
    const windowEnd = proposedShift.recurrenceEndAt
      ? proposedShift.recurrenceEndAt
      : new Date(windowStart.getTime() + 62 * 24 * 60 * 60_000);
    const proposed: ShiftRecurrenceInput = {
      recurrenceType: proposedShift.recurrenceType ?? RecurrenceType.NONE,
      scheduledStartAt: proposedShift.scheduledStartAt,
      scheduledEndAt: proposedShift.scheduledEndAt,
      recurrenceEndAt: proposedShift.recurrenceEndAt ?? null,
      recurrenceDaysOfWeek: proposedShift.recurrenceDaysOfWeek ?? [],
      timezone: proposedShift.timezone,
      organisationTimezone: proposedShift.organisation?.timezone,
    };

    for (const other of others) {
      const otherInput: ShiftRecurrenceInput = {
        recurrenceType: other.shift.recurrenceType,
        scheduledStartAt: other.shift.scheduledStartAt,
        scheduledEndAt: other.shift.scheduledEndAt,
        recurrenceEndAt: other.shift.recurrenceEndAt,
        recurrenceDaysOfWeek: other.shift.recurrenceDaysOfWeek,
        timezone: other.shift.timezone,
        organisationTimezone: other.shift.organisation?.timezone,
      };
      const overlaps =
        isRecurringShift(proposed.recurrenceType) ||
        isRecurringShift(otherInput.recurrenceType)
          ? recurrencesOverlap(proposed, otherInput, windowStart, windowEnd)
          : rangesOverlap(
              other.shift.scheduledStartAt,
              other.shift.scheduledEndAt,
              proposedShift.scheduledStartAt,
              proposedShift.scheduledEndAt,
            );
      if (overlaps) {
        throw new AppException(
          'Officer has an overlapping active assignment',
          HttpStatus.CONFLICT,
          ErrorCode.ASSIGNMENT_TIME_CONFLICT,
        );
      }
    }
  }

  private geofenceEnabled(): boolean {
    return (
      this.configService.get<boolean>('attendance.geofenceEnabled') ?? true
    );
  }

  private toRecurrenceInput(assignment: {
    shift?: {
      scheduledStartAt: Date;
      scheduledEndAt: Date;
      recurrenceType?: RecurrenceType | null;
      recurrenceEndAt?: Date | null;
      recurrenceDaysOfWeek?: number[] | null;
      timezone?: string | null;
      organisation?: { timezone: string } | null;
    } | null;
  }): ShiftRecurrenceInput {
    const shift = assignment.shift;
    return {
      recurrenceType: shift?.recurrenceType ?? RecurrenceType.NONE,
      scheduledStartAt: shift?.scheduledStartAt ?? new Date(0),
      scheduledEndAt: shift?.scheduledEndAt ?? new Date(0),
      recurrenceEndAt: shift?.recurrenceEndAt ?? null,
      recurrenceDaysOfWeek: shift?.recurrenceDaysOfWeek ?? [],
      timezone: shift?.timezone,
      organisationTimezone: shift?.organisation?.timezone,
    };
  }

  private occurrenceFor(
    assignment: Parameters<AssignmentsService['toRecurrenceInput']>[0] & {
      shift?: { gracePeriodMinutes?: number } | null;
    },
    now: Date,
    earlyMs: number,
  ) {
    const graceMs = (assignment.shift?.gracePeriodMinutes ?? 15) * 60_000;
    return resolveActiveOrUpcomingToday(
      this.toRecurrenceInput(assignment),
      now,
      earlyMs,
      graceMs,
    );
  }

  private toResponse(
    assignment: Parameters<typeof toAssignmentResponse>[0],
    occurrence?: { dateKey: string; startAt: Date; endAt: Date } | null,
  ) {
    const timezone =
      assignment.shift?.timezone ??
      assignment.shift?.organisation?.timezone ??
      null;
    return toAssignmentResponse(assignment, {
      geofenceEnforcementEnabled: this.geofenceEnabled(),
      timezone,
      occurrenceDate: occurrence?.dateKey ?? null,
      occurrenceStartAt: occurrence?.startAt ?? null,
      occurrenceEndAt: occurrence?.endAt ?? null,
    });
  }
}
