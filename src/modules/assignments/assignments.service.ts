import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AssignmentStatus,
  AuditAction,
  OfficerEmploymentStatus,
  Prisma,
  ShiftStatus,
  SiteStatus,
} from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
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

const ASSIGNMENT_SORT_FIELDS = [
  'assignedAt',
  'confirmedAt',
  'status',
  'createdAt',
] as const;

const ASSIGNMENT_INCLUDE = {
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
      scheduledStartAt: true,
      scheduledEndAt: true,
    },
  },
} satisfies Prisma.AssignmentInclude;

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuthAuditService,
    private readonly accessService: AssignmentAccessService,
  ) {}

  async create(
    user: RequestUser,
    dto: CreateAssignmentDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);

    const created = await this.prisma.$transaction(async (tx) => {
      const shift = await this.loadAssignableShift(
        tx,
        organisationId,
        dto.shiftId,
      );
      await this.assertOfficerAssignable(tx, organisationId, dto.officerId);
      if (dto.supervisorId) {
        await this.assertSupervisorAssignable(
          tx,
          organisationId,
          dto.supervisorId,
        );
      }

      await this.assertNoDuplicate(
        tx,
        organisationId,
        dto.shiftId,
        dto.officerId,
      );
      await this.assertNoOverlap(
        tx,
        organisationId,
        dto.officerId,
        shift.scheduledStartAt,
        shift.scheduledEndAt,
      );

      const assignment = await tx.assignment.create({
        data: {
          organisationId,
          shiftId: dto.shiftId,
          officerId: dto.officerId,
          supervisorId: dto.supervisorId ?? null,
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
      },
    });

    return toAssignmentResponse(created);
  }

  async createBatch(
    user: RequestUser,
    dto: BatchCreateAssignmentsDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const uniqueOfficerIds = [...new Set(dto.officerIds)];

    const created = await this.prisma.$transaction(async (tx) => {
      const shift = await this.loadAssignableShift(
        tx,
        organisationId,
        dto.shiftId,
      );
      if (dto.supervisorId) {
        await this.assertSupervisorAssignable(
          tx,
          organisationId,
          dto.supervisorId,
        );
      }

      for (const officerId of uniqueOfficerIds) {
        await this.assertOfficerAssignable(tx, organisationId, officerId);
        await this.assertNoDuplicate(
          tx,
          organisationId,
          dto.shiftId,
          officerId,
        );
        await this.assertNoOverlap(
          tx,
          organisationId,
          officerId,
          shift.scheduledStartAt,
          shift.scheduledEndAt,
        );
      }

      const results = [];
      for (const officerId of uniqueOfficerIds) {
        const assignment = await tx.assignment.create({
          data: {
            organisationId,
            shiftId: dto.shiftId,
            officerId,
            supervisorId: dto.supervisorId ?? null,
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
      },
    });

    return { data: created.map((a) => toAssignmentResponse(a)) };
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

    const where: Prisma.AssignmentWhereInput = {
      organisationId,
      ...(query.officerId ? { officerId: query.officerId } : {}),
      ...(query.supervisorId ? { supervisorId: query.supervisorId } : {}),
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
      data: items.map((a) => toAssignmentResponse(a)),
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

    const candidates = await this.prisma.assignment.findMany({
      where: {
        organisationId,
        officerId,
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

    const relevant = candidates.find((assignment) => {
      if (!assignment.shift) {
        return false;
      }
      const graceMs = assignment.shift.gracePeriodMinutes * 60_000;
      const windowStart = new Date(
        assignment.shift.scheduledStartAt.getTime() - 30 * 60_000,
      );
      const windowEnd = new Date(
        assignment.shift.scheduledEndAt.getTime() + graceMs,
      );
      return now >= windowStart && now <= windowEnd;
    });

    if (!relevant) {
      return null;
    }

    return toAssignmentResponse(relevant);
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
    const to = query.to ? new Date(query.to) : undefined;

    const where: Prisma.AssignmentWhereInput = {
      organisationId,
      officerId,
      status: {
        in: [AssignmentStatus.ASSIGNED, AssignmentStatus.CONFIRMED],
      },
      shift: {
        deletedAt: null,
        scheduledStartAt: {
          gte: from,
          ...(to ? { lte: to } : {}),
        },
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.assignment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { shift: { scheduledStartAt: 'asc' } },
        include: ASSIGNMENT_INCLUDE,
      }),
      this.prisma.assignment.count({ where }),
    ]);

    return {
      data: items.map((a) => toAssignmentResponse(a)),
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

    return toAssignmentResponse(assignment);
  }

  async updateStatus(
    user: RequestUser,
    id: string,
    dto: UpdateAssignmentStatusDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findAssignmentOrThrow(organisationId, id);
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

    return toAssignmentResponse(updated);
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

    return toAssignmentResponse(updated);
  }

  async reassign(
    user: RequestUser,
    id: string,
    dto: ReassignAssignmentDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findAssignmentOrThrow(organisationId, id);

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
        shift.scheduledStartAt,
        shift.scheduledEndAt,
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
      original: toAssignmentResponse(result.original),
      replacement: toAssignmentResponse(result.replacement),
    };
  }

  async cancel(user: RequestUser, id: string, ctx: ServiceRequestContext) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findAssignmentOrThrow(organisationId, id);

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
    proposedStart: Date,
    proposedEnd: Date,
    ignoreAssignmentId?: string,
  ) {
    const others = await tx.assignment.findMany({
      where: {
        organisationId,
        officerId,
        status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] },
        ...(ignoreAssignmentId ? { id: { not: ignoreAssignmentId } } : {}),
        shift: { deletedAt: null },
      },
      include: {
        shift: {
          select: { scheduledStartAt: true, scheduledEndAt: true },
        },
      },
    });

    for (const other of others) {
      if (
        rangesOverlap(
          other.shift.scheduledStartAt,
          other.shift.scheduledEndAt,
          proposedStart,
          proposedEnd,
        )
      ) {
        throw new AppException(
          'Officer has an overlapping active assignment',
          HttpStatus.CONFLICT,
          ErrorCode.ASSIGNMENT_TIME_CONFLICT,
        );
      }
    }
  }
}
