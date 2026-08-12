import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AssignmentStatus,
  AuditAction,
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
import { AssignmentAccessService } from '../assignments/assignment-access.service';
import { ACTIVE_ASSIGNMENT_STATUSES } from '../assignments/assignment-transitions.util';
import { rangesOverlap } from '../assignments/assignment-overlap.util';
import { toAssignmentResponse } from '../assignments/mappers/assignment.mapper';
import type { CreateShiftDto } from './dto/create-shift.dto';
import type { ListShiftsQueryDto } from './dto/list-shifts-query.dto';
import type { UpdateShiftDto } from './dto/update-shift.dto';
import type { UpdateShiftStatusDto } from './dto/update-shift-status.dto';
import { toShiftResponse } from './mappers/shift.mapper';
import { assertShiftScheduleValid } from './shift-validation.util';
import {
  assertShiftTransition,
  shiftTransitionRequiresReason,
} from './shift-transitions.util';

const SHIFT_SORT_FIELDS = [
  'scheduledStartAt',
  'scheduledEndAt',
  'createdAt',
  'title',
  'status',
] as const;

const SHIFT_INCLUDE = {
  site: {
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      client: { select: { id: true, name: true, status: true } },
    },
  },
  _count: { select: { assignments: true } },
} satisfies Prisma.ShiftInclude;

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuthAuditService,
    private readonly configService: ConfigService,
    private readonly assignmentAccess: AssignmentAccessService,
  ) {}

  async create(
    user: RequestUser,
    dto: CreateShiftDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const maxDurationHours =
      this.configService.get<number>('shift.maxDurationHours') ?? 24;

    const scheduledStartAt = new Date(dto.scheduledStartAt);
    const scheduledEndAt = new Date(dto.scheduledEndAt);
    const unpaidBreakMinutes = dto.unpaidBreakMinutes ?? 0;

    assertShiftScheduleValid({
      scheduledStartAt,
      scheduledEndAt,
      unpaidBreakMinutes,
      maxDurationHours,
    });

    await this.assertSiteAssignable(organisationId, dto.siteId);

    const shift = await this.prisma.shift.create({
      data: {
        organisationId,
        siteId: dto.siteId,
        title: dto.title.trim(),
        description: trimOrUndefined(dto.description) ?? null,
        scheduledStartAt,
        scheduledEndAt,
        unpaidBreakMinutes,
        gracePeriodMinutes: dto.gracePeriodMinutes ?? 15,
        overtimeThresholdMinutes: dto.overtimeThresholdMinutes ?? null,
        instructions: trimOrUndefined(dto.instructions) ?? null,
        status: dto.asDraft ? ShiftStatus.DRAFT : ShiftStatus.SCHEDULED,
        createdByUserId: user.id,
      },
      include: SHIFT_INCLUDE,
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      entityType: 'Shift',
      entityId: shift.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { status: shift.status, siteId: shift.siteId },
    });

    return toShiftResponse(shift);
  }

  async findAll(user: RequestUser, query: ListShiftsQueryDto) {
    const organisationId = requireOrganisationId(user);
    if (!userHasPermission(user, 'shift:read')) {
      throw new AppException(
        'Insufficient permissions',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      );
    }

    const scope = await this.assignmentAccess.resolveSupervisorOperationalScope(
      user,
      organisationId,
    );

    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const sortBy = assertAllowedSortField(
      query.sortBy,
      SHIFT_SORT_FIELDS,
      'scheduledStartAt',
    );
    const sortOrder = query.sortOrder ?? 'asc';

    const supervisorAssignmentFilter: Prisma.ShiftWhereInput = scope
      ? {
          assignments: {
            some: {
              AND: [
                {
                  OR: [
                    { supervisorId: scope.supervisorProfileId || '__none__' },
                    ...(scope.officerIds.length > 0
                      ? [{ officerId: { in: scope.officerIds } }]
                      : []),
                  ],
                },
                ...(query.officerId
                  ? [
                      {
                        officerId: scope.officerIds.includes(query.officerId)
                          ? query.officerId
                          : '__none__',
                      },
                    ]
                  : []),
              ],
            },
          },
        }
      : query.officerId || query.supervisorId
        ? {
            assignments: {
              some: {
                ...(query.officerId ? { officerId: query.officerId } : {}),
                ...(query.supervisorId
                  ? { supervisorId: query.supervisorId }
                  : {}),
              },
            },
          }
        : {};

    const where: Prisma.ShiftWhereInput = {
      organisationId,
      ...supervisorAssignmentFilter,
      ...(query.includeArchived
        ? {}
        : {
            deletedAt: null,
            ...(query.status
              ? { status: query.status }
              : { status: { not: ShiftStatus.ARCHIVED } }),
          }),
      ...(query.includeArchived && query.status
        ? { status: query.status }
        : {}),
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.clientId ? { site: { clientId: query.clientId } } : {}),
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
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              {
                site: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.shift.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy!]: sortOrder },
        include: SHIFT_INCLUDE,
      }),
      this.prisma.shift.count({ where }),
    ]);

    return {
      data: items.map((s) => toShiftResponse(s)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(user: RequestUser, id: string) {
    const organisationId = requireOrganisationId(user);
    const canReadOrg = userHasPermission(user, 'shift:read');
    const canReadSelf = userHasPermission(user, 'shift:read:self');
    const scope = await this.assignmentAccess.resolveSupervisorOperationalScope(
      user,
      organisationId,
    );

    if (!canReadOrg && !canReadSelf) {
      throw new AppException(
        'Insufficient permissions',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      );
    }

    const shift = await this.prisma.shift.findFirst({
      where: {
        id,
        organisationId,
        deletedAt: null,
        ...(scope
          ? {
              assignments: {
                some: {
                  OR: [
                    { supervisorId: scope.supervisorProfileId || '__none__' },
                    ...(scope.officerIds.length > 0
                      ? [{ officerId: { in: scope.officerIds } }]
                      : []),
                  ],
                },
              },
            }
          : {}),
      },
      include: {
        ...SHIFT_INCLUDE,
        assignments: {
          select: {
            id: true,
            officerId: true,
            supervisorId: true,
            status: true,
            assignedAt: true,
            confirmedAt: true,
          },
          take: 50,
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    if (!shift) {
      tenantNotFound(ErrorCode.SHIFT_NOT_FOUND);
    }

    if (!scope && !canReadOrg && canReadSelf) {
      const officer = await this.prisma.officerProfile.findFirst({
        where: { userId: user.id, organisationId, deletedAt: null },
        select: { id: true },
      });
      const isAssigned =
        officer && shift.assignments.some((a) => a.officerId === officer.id);
      if (!isAssigned) {
        tenantNotFound(ErrorCode.SHIFT_NOT_FOUND);
      }
    }

    const includeAssignments =
      canReadOrg || userHasPermission(user, 'assignment:read');

    return toShiftResponse(shift, { includeAssignments });
  }

  async getAssignmentForShift(user: RequestUser, shiftId: string) {
    const organisationId = requireOrganisationId(user);
    // Ensures tenant + self access to the shift (404 if not visible).
    await this.findOne(user, shiftId);

    const officerId = await this.assignmentAccess.resolveOfficerProfileId(
      user,
      organisationId,
    );

    const assignment = await this.prisma.assignment.findFirst({
      where: {
        organisationId,
        shiftId,
        officerId,
      },
      include: {
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
            scheduledStartAt: true,
            scheduledEndAt: true,
            siteId: true,
            gracePeriodMinutes: true,
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
      },
      orderBy: { assignedAt: 'desc' },
    });

    return assignment ? toAssignmentResponse(assignment) : null;
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateShiftDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findShiftOrThrow(organisationId, id);

    if (
      existing.status === ShiftStatus.COMPLETED ||
      existing.status === ShiftStatus.CANCELLED ||
      existing.status === ShiftStatus.ARCHIVED
    ) {
      throw new AppException(
        'Shift cannot be edited in its current status',
        HttpStatus.CONFLICT,
        ErrorCode.SHIFT_IMMUTABLE,
      );
    }

    if (existing.status === ShiftStatus.IN_PROGRESS) {
      if (
        dto.siteId !== undefined ||
        dto.scheduledStartAt !== undefined ||
        dto.scheduledEndAt !== undefined ||
        dto.unpaidBreakMinutes !== undefined
      ) {
        throw new AppException(
          'In-progress shifts cannot change site, start time, or duration',
          HttpStatus.CONFLICT,
          ErrorCode.SHIFT_ALREADY_STARTED,
        );
      }
    }

    if (dto.siteId !== undefined && dto.siteId !== existing.siteId) {
      await this.assertSiteAssignable(organisationId, dto.siteId);
    }

    const scheduledStartAt = dto.scheduledStartAt
      ? new Date(dto.scheduledStartAt)
      : existing.scheduledStartAt;
    const scheduledEndAt = dto.scheduledEndAt
      ? new Date(dto.scheduledEndAt)
      : existing.scheduledEndAt;
    const unpaidBreakMinutes =
      dto.unpaidBreakMinutes ?? existing.unpaidBreakMinutes;
    const maxDurationHours =
      this.configService.get<number>('shift.maxDurationHours') ?? 24;

    if (
      dto.scheduledStartAt !== undefined ||
      dto.scheduledEndAt !== undefined ||
      dto.unpaidBreakMinutes !== undefined
    ) {
      assertShiftScheduleValid({
        scheduledStartAt,
        scheduledEndAt,
        unpaidBreakMinutes,
        maxDurationHours,
      });
    }

    if (
      dto.scheduledStartAt !== undefined ||
      dto.scheduledEndAt !== undefined
    ) {
      await this.assertNoAssignmentConflictsOnReschedule(
        organisationId,
        existing.id,
        scheduledStartAt,
        scheduledEndAt,
      );
    }

    const updated = await this.prisma.shift.update({
      where: { id: existing.id },
      data: {
        ...(dto.siteId !== undefined ? { siteId: dto.siteId } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: trimOrUndefined(dto.description) ?? null }
          : {}),
        ...(dto.scheduledStartAt !== undefined ? { scheduledStartAt } : {}),
        ...(dto.scheduledEndAt !== undefined ? { scheduledEndAt } : {}),
        ...(dto.unpaidBreakMinutes !== undefined ? { unpaidBreakMinutes } : {}),
        ...(dto.gracePeriodMinutes !== undefined
          ? { gracePeriodMinutes: dto.gracePeriodMinutes }
          : {}),
        ...(dto.overtimeThresholdMinutes !== undefined
          ? { overtimeThresholdMinutes: dto.overtimeThresholdMinutes }
          : {}),
        ...(dto.instructions !== undefined
          ? { instructions: trimOrUndefined(dto.instructions) ?? null }
          : {}),
      },
      include: SHIFT_INCLUDE,
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'Shift',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { fields: Object.keys(dto) },
    });

    return toShiftResponse(updated);
  }

  async updateStatus(
    user: RequestUser,
    id: string,
    dto: UpdateShiftStatusDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findShiftOrThrow(organisationId, id);

    assertShiftTransition(existing.status, dto.status);

    if (
      shiftTransitionRequiresReason(existing.status, dto.status) &&
      !trimOrUndefined(dto.reason)
    ) {
      throw new AppException(
        'A reason is required for this status transition',
        HttpStatus.BAD_REQUEST,
        ErrorCode.ATTENDANCE_REASON_REQUIRED,
      );
    }

    const now = new Date();
    const isCancel = dto.status === ShiftStatus.CANCELLED;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (isCancel) {
        const activeAssignments = await tx.assignment.findMany({
          where: {
            shiftId: existing.id,
            organisationId,
            status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] },
          },
        });

        for (const assignment of activeAssignments) {
          await tx.assignment.update({
            where: { id: assignment.id },
            data: {
              status: AssignmentStatus.CANCELLED,
              cancelledAt: now,
              cancellationReason:
                trimOrUndefined(dto.reason) ?? 'Shift cancelled',
            },
          });
          await tx.assignmentEvent.create({
            data: {
              assignmentId: assignment.id,
              actorUserId: user.id,
              previousStatus: assignment.status,
              newStatus: AssignmentStatus.CANCELLED,
              reason: trimOrUndefined(dto.reason) ?? 'Shift cancelled',
            },
          });
        }
      }

      return tx.shift.update({
        where: { id: existing.id },
        data: {
          status: dto.status,
          ...(isCancel
            ? {
                cancellationReason: trimOrUndefined(dto.reason) ?? null,
                cancelledAt: now,
                cancelledByUserId: user.id,
              }
            : {}),
          ...(dto.status === ShiftStatus.ARCHIVED ? { deletedAt: now } : {}),
        },
        include: SHIFT_INCLUDE,
      });
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'Shift',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        previousStatus: existing.status,
        newStatus: dto.status,
        reason: trimOrUndefined(dto.reason) ?? null,
      },
    });

    return toShiftResponse(updated);
  }

  async archive(user: RequestUser, id: string, ctx: ServiceRequestContext) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findShiftOrThrow(organisationId, id);

    if (existing.status === ShiftStatus.ARCHIVED || existing.deletedAt) {
      return;
    }

    if (
      existing.status !== ShiftStatus.COMPLETED &&
      existing.status !== ShiftStatus.CANCELLED
    ) {
      assertShiftTransition(existing.status, ShiftStatus.ARCHIVED);
    }

    const now = new Date();
    await this.prisma.shift.update({
      where: { id: existing.id },
      data: {
        status: ShiftStatus.ARCHIVED,
        deletedAt: now,
      },
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.DELETE,
      entityType: 'Shift',
      entityId: existing.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { softArchive: true },
    });
  }

  private async findShiftOrThrow(organisationId: string, id: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { id, organisationId, deletedAt: null },
      include: SHIFT_INCLUDE,
    });
    if (!shift) {
      tenantNotFound(ErrorCode.SHIFT_NOT_FOUND);
    }
    return shift;
  }

  private async assertSiteAssignable(
    organisationId: string,
    siteId: string,
  ): Promise<void> {
    const site = await this.prisma.securitySite.findFirst({
      where: { id: siteId, organisationId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!site) {
      tenantNotFound(ErrorCode.SITE_NOT_FOUND);
    }
    if (site.status !== SiteStatus.ACTIVE) {
      throw new AppException(
        'Site is not active',
        HttpStatus.CONFLICT,
        ErrorCode.SHIFT_SITE_INACTIVE,
      );
    }
  }

  private async assertNoAssignmentConflictsOnReschedule(
    organisationId: string,
    shiftId: string,
    scheduledStartAt: Date,
    scheduledEndAt: Date,
  ): Promise<void> {
    const assignments = await this.prisma.assignment.findMany({
      where: {
        shiftId,
        organisationId,
        status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] },
      },
      select: { officerId: true },
    });

    for (const assignment of assignments) {
      const others = await this.prisma.assignment.findMany({
        where: {
          organisationId,
          officerId: assignment.officerId,
          status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] },
          shiftId: { not: shiftId },
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
            scheduledStartAt,
            scheduledEndAt,
          )
        ) {
          throw new AppException(
            'Reschedule conflicts with another active assignment',
            HttpStatus.CONFLICT,
            ErrorCode.ASSIGNMENT_TIME_CONFLICT,
          );
        }
      }
    }
  }
}
