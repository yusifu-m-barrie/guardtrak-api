import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  AssignmentStatus,
  AttendanceEventType,
  AttendanceStatus,
  AuditAction,
  BreakStatus,
  DeviceStatus,
  EvidenceStatus,
  EvidenceType,
  GeofencePolicy,
  Prisma,
  ShiftStatus,
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
import { AssignmentAccessService } from '../assignments/assignment-access.service';
import type { ServiceRequestContext } from '../clients/clients.types';
import { toEvidenceResponse } from '../evidence/mappers/evidence.mapper';
import { LocalStorageProvider } from '../storage/local-storage.provider';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../storage/storage.types';
import { AttendanceAuditService } from './attendance-audit.service';
import { AttendanceCalculationService } from './attendance-calculation.service';
import {
  ACTIVE_ATTENDANCE_STATUSES,
  assertAttendanceTransition,
} from './attendance-transitions.util';
import type { AttendanceReasonDto } from './dto/attendance-reason.dto';
import type { ClockInDto } from './dto/clock-in.dto';
import type { ClockOutDto } from './dto/clock-out.dto';
import type { CorrectAttendanceDto } from './dto/correct-attendance.dto';
import type { ListAttendanceQueryDto } from './dto/list-attendance-query.dto';
import type { ListMyAttendanceQueryDto } from './dto/list-my-attendance-query.dto';
import { GeofenceService } from './geofence.service';
import { toAttendanceResponse } from './mappers/attendance.mapper';
import {
  isRecurringShift,
  occurrenceOnDate,
  resolveClockInOccurrence,
} from '../shifts/shift-recurrence.util';
import {
  dateKeyToUtcDate,
  resolveTimeZone,
  zonedDateKey,
} from '../../common/utils/timezone.util';

const ATTENDANCE_SORT_FIELDS = [
  'clockInServerAt',
  'createdAt',
  'status',
] as const;

const ATTENDANCE_INCLUDE = {
  assignment: {
    select: {
      id: true,
      status: true,
      officerId: true,
      supervisorId: true,
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
          employeeId: true,
          firstName: true,
          lastName: true,
          displayName: true,
          avatarUrl: true,
          email: true,
          phone: true,
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
      unpaidBreakMinutes: true,
      gracePeriodMinutes: true,
      overtimeThresholdMinutes: true,
      recurrenceType: true,
      recurrenceEndAt: true,
      recurrenceDaysOfWeek: true,
      timezone: true,
      organisation: {
        select: { timezone: true },
      },
    },
  },
  site: {
    select: {
      id: true,
      name: true,
      code: true,
      address: true,
      latitude: true,
      longitude: true,
      clockInRadiusMeters: true,
      clockOutRadiusMeters: true,
      checkpointDefaultRadiusMeters: true,
      clockInOutsideGeofencePolicy: true,
      clockOutOutsideGeofencePolicy: true,
      minimumGpsAccuracyMeters: true,
      requiresClockInSelfie: true,
      requiresClockOutSelfie: true,
      requiresPatrol: true,
      requiresFinalShiftNote: true,
      instructions: true,
      status: true,
    },
  },
  breaks: {
    select: {
      id: true,
      type: true,
      status: true,
      startedAtServer: true,
      endedAtServer: true,
      durationMinutes: true,
    },
  },
} satisfies Prisma.AttendanceInclude;

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly geofenceService: GeofenceService,
    private readonly calculationService: AttendanceCalculationService,
    private readonly auditService: AttendanceAuditService,
    private readonly accessService: AssignmentAccessService,
    private readonly idempotencyService: IdempotencyService,
    private readonly localStorage: LocalStorageProvider,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
  ) {}

  /**
   * Upload a clock-in/out selfie before attendance mutation.
   * Returns an evidenceId that must be passed as ClockInDto.evidenceId / ClockOutDto.evidenceId.
   */
  async uploadSelfie(
    user: RequestUser,
    file: Express.Multer.File | undefined,
    ctx: ServiceRequestContext,
    purpose: 'clock-in' | 'clock-out' = 'clock-in',
  ) {
    if (!file?.buffer?.length) {
      throw new AppException(
        'Selfie file is required',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        [{ field: 'file', message: 'Multipart file field is required' }],
      );
    }
    const mimeType = file.mimetype || 'application/octet-stream';
    if (!mimeType.startsWith('image/')) {
      throw new AppException(
        'Selfie must be an image',
        HttpStatus.BAD_REQUEST,
        ErrorCode.STORAGE_CONTENT_TYPE_INVALID,
        [{ field: 'file', message: `Unexpected mimeType ${mimeType}` }],
      );
    }
    const maxBytes =
      this.configService.get<number>('storage.maxImageSizeBytes') ?? 10_485_760;
    if (file.size > maxBytes) {
      throw new AppException(
        'Selfie exceeds maximum allowed size',
        HttpStatus.BAD_REQUEST,
        ErrorCode.STORAGE_FILE_TOO_LARGE,
      );
    }

    const organisationId = requireOrganisationId(user);
    const evidenceId = randomUUID();
    const ext = mimeType.includes('png')
      ? '.png'
      : mimeType.includes('webp')
        ? '.webp'
        : '.jpg';
    const storageKey = `${organisationId}/attendance/selfies/${user.id}/${evidenceId}${ext}`;
    this.localStorage.putObject(storageKey, file.buffer);
    const bucket = this.configService.get<string>('storage.bucket') || 'local';

    const evidence = await this.prisma.evidence.create({
      data: {
        id: evidenceId,
        organisationId,
        uploadedByUserId: user.id,
        type: EvidenceType.IMAGE,
        status: EvidenceStatus.AVAILABLE,
        originalFileName: file.originalname || `selfie-${purpose}${ext}`,
        storageProvider: 'local',
        storageBucket: bucket,
        storageKey,
        mimeType,
        sizeBytes: file.size,
        uploadedAt: new Date(),
        metadata: { purpose: `attendance-${purpose}` },
      },
    });

    await this.auditService.record(
      {
        organisationId,
        actorUserId: user.id,
        action: AuditAction.UPLOAD,
        entityId: evidence.id,
        metadata: { action: 'attendance-selfie', purpose },
      },
      ctx,
    );

    return { evidenceId: evidence.id };
  }

  private async assertSelfieEvidenceOwned(
    organisationId: string,
    userId: string,
    evidenceId: string,
  ): Promise<void> {
    const evidence = await this.prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        organisationId,
        uploadedByUserId: userId,
        deletedAt: null,
        status: {
          in: [EvidenceStatus.AVAILABLE, EvidenceStatus.UPLOADED],
        },
      },
      select: { id: true },
    });
    if (!evidence) {
      throw new AppException(
        'Selfie evidence was not found or is not ready',
        HttpStatus.BAD_REQUEST,
        ErrorCode.ATTENDANCE_EVIDENCE_REQUIRED,
      );
    }
  }

  async clockIn(
    user: RequestUser,
    dto: ClockInDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const officerId = await this.accessService.resolveOfficerProfileId(
      user,
      organisationId,
    );
    const ttl =
      this.configService.get<number>('attendance.idempotencyTtlSeconds') ??
      86_400;
    const requestHash = hashRequestPayload({
      assignmentId: dto.assignmentId,
      deviceTimestamp: dto.deviceTimestamp,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracyMeters: dto.accuracyMeters,
      reason: dto.reason ?? null,
      evidenceId: dto.evidenceId ?? null,
      localAttendanceId: dto.localAttendanceId ?? null,
    });

    const begin = await this.idempotencyService.begin({
      key: dto.idempotencyKey,
      organisationId,
      userId: user.id,
      operation: 'attendance.clock-in',
      requestHash,
      ttlSeconds: ttl,
    });

    if (begin.replay && begin.record?.responseBody) {
      return begin.record.responseBody;
    }

    try {
      const response = await this.performClockIn(
        user,
        organisationId,
        officerId,
        dto,
        ctx,
      );
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
        error instanceof Error ? error.message : 'clock-in failed',
      );
      throw error;
    }
  }

  async clockOut(
    user: RequestUser,
    dto: ClockOutDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const officerId = await this.accessService.resolveOfficerProfileId(
      user,
      organisationId,
    );
    const ttl =
      this.configService.get<number>('attendance.idempotencyTtlSeconds') ??
      86_400;
    const requestHash = hashRequestPayload({
      attendanceId: dto.attendanceId,
      deviceTimestamp: dto.deviceTimestamp,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracyMeters: dto.accuracyMeters,
      reason: dto.reason ?? null,
      finalShiftNote: dto.finalShiftNote ?? null,
      evidenceId: dto.evidenceId ?? null,
    });

    const begin = await this.idempotencyService.begin({
      key: dto.idempotencyKey,
      organisationId,
      userId: user.id,
      operation: 'attendance.clock-out',
      requestHash,
      ttlSeconds: ttl,
    });

    if (begin.replay && begin.record?.responseBody) {
      return begin.record.responseBody;
    }

    try {
      const response = await this.performClockOut(
        user,
        organisationId,
        officerId,
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
        error instanceof Error ? error.message : 'clock-out failed',
      );
      throw error;
    }
  }

  async getCurrent(user: RequestUser) {
    const organisationId = requireOrganisationId(user);
    const officerId = await this.accessService.resolveOfficerProfileId(
      user,
      organisationId,
    );

    const attendance = await this.prisma.attendance.findFirst({
      where: {
        organisationId,
        officerId,
        deletedAt: null,
        status: { in: [...ACTIVE_ATTENDANCE_STATUSES] },
      },
      include: {
        ...ATTENDANCE_INCLUDE,
        events: { orderBy: { createdAt: 'asc' }, take: 20 },
      },
      orderBy: { clockInServerAt: 'desc' },
    });

    if (!attendance) {
      return null;
    }

    const elapsedMinutes = attendance.clockInServerAt
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - attendance.clockInServerAt.getTime()) / 60_000,
          ),
        )
      : 0;

    return toAttendanceResponse(attendance, {
      includeEvents: true,
      elapsedMinutes,
    });
  }

  async listMine(user: RequestUser, query: ListMyAttendanceQueryDto) {
    const organisationId = requireOrganisationId(user);
    const officerId = await this.accessService.resolveOfficerProfileId(
      user,
      organisationId,
    );
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.AttendanceWhereInput = {
      organisationId,
      officerId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.from || query.to
        ? {
            clockInServerAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { clockInServerAt: sortOrder },
        include: ATTENDANCE_INCLUDE,
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return {
      data: items.map((item) => toAttendanceResponse(item)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async list(user: RequestUser, query: ListAttendanceQueryDto) {
    const organisationId = requireOrganisationId(user);
    if (!userHasPermission(user, 'attendance:read')) {
      throw new AppException(
        'Insufficient permissions',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      );
    }

    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const sortBy = assertAllowedSortField(
      query.sortBy,
      ATTENDANCE_SORT_FIELDS,
      'clockInServerAt',
    );
    const sortOrder = query.sortOrder ?? 'desc';

    let supervisorOfficerScope: Prisma.AttendanceWhereInput | undefined;
    if (user.role === AppUserRole.SUPERVISOR) {
      const supervisorProfileId =
        await this.accessService.resolveSupervisorProfileId(
          user,
          organisationId,
        );
      if (!supervisorProfileId) {
        supervisorOfficerScope = { officerId: { in: [] } };
      } else {
        const officerIds = await this.accessService.listAssignedOfficerIds(
          organisationId,
          supervisorProfileId,
        );
        if (query.officerId && !officerIds.includes(query.officerId)) {
          supervisorOfficerScope = { officerId: { in: [] } };
        } else {
          supervisorOfficerScope = {
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

    const where: Prisma.AttendanceWhereInput = {
      organisationId,
      deletedAt: null,
      ...supervisorOfficerScope,
      ...(query.officerId && user.role !== AppUserRole.SUPERVISOR
        ? { officerId: query.officerId }
        : {}),
      ...(query.shiftId ? { shiftId: query.shiftId } : {}),
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.supervisorId
        ? { assignment: { supervisorId: query.supervisorId } }
        : {}),
      ...(query.outsideGeofence
        ? {
            OR: [
              { clockInOutsideGeofence: true },
              { clockOutOutsideGeofence: true },
            ],
          }
        : {}),
      ...(query.pendingReview
        ? { status: AttendanceStatus.PENDING_SUPERVISOR_APPROVAL }
        : {}),
      ...(query.from || query.to
        ? {
            clockInServerAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy!]: sortOrder },
        include: ATTENDANCE_INCLUDE,
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return {
      data: items.map((item) => toAttendanceResponse(item)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(user: RequestUser, id: string) {
    const organisationId = requireOrganisationId(user);
    const attendance = await this.prisma.attendance.findFirst({
      where: { id, organisationId, deletedAt: null },
      include: {
        ...ATTENDANCE_INCLUDE,
        events: {
          orderBy: { createdAt: 'asc' },
          include: {
            device: {
              select: {
                id: true,
                platform: true,
                deviceName: true,
                manufacturer: true,
                model: true,
                appVersion: true,
                status: true,
                installationId: true,
              },
            },
          },
        },
      },
    });
    if (!attendance) {
      tenantNotFound(ErrorCode.ATTENDANCE_NOT_FOUND);
    }

    await this.assertCanReadAttendance(user, organisationId, attendance);

    return toAttendanceResponse(attendance, { includeEvents: true });
  }

  /**
   * Clock-in / clock-out selfie evidence for supervisors and admins
   * (also visible to the officer who owns the attendance).
   */
  async listEvidence(user: RequestUser, attendanceId: string) {
    const organisationId = requireOrganisationId(user);
    const attendance = await this.prisma.attendance.findFirst({
      where: { id: attendanceId, organisationId, deletedAt: null },
      include: {
        assignment: {
          select: {
            id: true,
            status: true,
            officerId: true,
            supervisorId: true,
          },
        },
      },
    });
    if (!attendance) {
      tenantNotFound(ErrorCode.ATTENDANCE_NOT_FOUND);
    }
    await this.assertCanReadAttendance(user, organisationId, attendance);

    const evidenceIds = [
      attendance.clockInEvidenceId,
      attendance.clockOutEvidenceId,
    ].filter((id): id is string => Boolean(id));

    const userSelect = {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      displayName: true,
      avatarUrl: true,
    } as const;

    const rows = await this.prisma.evidence.findMany({
      where: {
        organisationId,
        deletedAt: null,
        OR: [
          { attendanceId: attendance.id },
          ...(evidenceIds.length ? [{ id: { in: evidenceIds } }] : []),
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        uploadedByUser: { select: userSelect },
        verifiedByUser: { select: userSelect },
      },
    });

    // Backfill attendanceId for selfies uploaded before linking existed.
    const unlinked = rows.filter(
      (row) =>
        row.attendanceId !== attendance.id && evidenceIds.includes(row.id),
    );
    if (unlinked.length) {
      await this.prisma.evidence.updateMany({
        where: { id: { in: unlinked.map((r) => r.id) } },
        data: { attendanceId: attendance.id },
      });
    }

    const ttl =
      this.configService.get<number>('storage.signedUrlTtlSeconds') ?? 900;

    return Promise.all(
      rows.map(async (row) => {
        const purpose =
          row.id === attendance.clockInEvidenceId
            ? 'clock-in'
            : row.id === attendance.clockOutEvidenceId
              ? 'clock-out'
              : ((row.metadata as { purpose?: string } | null)?.purpose ??
                null);
        if (
          row.status === EvidenceStatus.AVAILABLE ||
          row.status === EvidenceStatus.UPLOADED
        ) {
          try {
            const signed = await this.storage.getSignedDownloadUrl(
              row.storageKey,
              ttl,
            );
            return {
              ...toEvidenceResponse(row, {
                downloadUrl: signed.downloadUrl,
                downloadExpiresAt: signed.expiresAt.toISOString(),
              }),
              purpose,
            };
          } catch {
            return { ...toEvidenceResponse(row), purpose };
          }
        }
        return { ...toEvidenceResponse(row), purpose };
      }),
    );
  }

  async requestReview(
    user: RequestUser,
    id: string,
    dto: AttendanceReasonDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const officerId = await this.accessService.resolveOfficerProfileId(
      user,
      organisationId,
    );
    const attendance = await this.findAttendanceOrThrow(organisationId, id);
    if (attendance.officerId !== officerId) {
      tenantNotFound(ErrorCode.ATTENDANCE_NOT_FOUND);
    }

    assertAttendanceTransition(
      attendance.status,
      AttendanceStatus.PENDING_SUPERVISOR_APPROVAL,
    );

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.attendance.update({
        where: { id: attendance.id },
        data: {
          status: AttendanceStatus.PENDING_SUPERVISOR_APPROVAL,
          approvalRequestedAt: now,
        },
        include: ATTENDANCE_INCLUDE,
      });
      await tx.attendanceEvent.create({
        data: {
          organisationId,
          attendanceId: row.id,
          type: AttendanceEventType.CLOCK_OUT_REVIEW_REQUESTED,
          actorUserId: user.id,
          serverTimestamp: now,
          reason: dto.reason.trim(),
        },
      });
      return row;
    });

    await this.auditService.record(
      {
        organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entityId: updated.id,
        metadata: { action: 'request-review' },
      },
      ctx,
    );

    return toAttendanceResponse(updated);
  }

  async approve(
    user: RequestUser,
    id: string,
    dto: AttendanceReasonDto,
    ctx: ServiceRequestContext,
  ) {
    return this.review(
      user,
      id,
      dto,
      AttendanceStatus.SUPERVISOR_APPROVED,
      AttendanceEventType.APPROVED,
      ctx,
    );
  }

  async reject(
    user: RequestUser,
    id: string,
    dto: AttendanceReasonDto,
    ctx: ServiceRequestContext,
  ) {
    return this.review(
      user,
      id,
      dto,
      AttendanceStatus.SUPERVISOR_REJECTED,
      AttendanceEventType.REJECTED,
      ctx,
    );
  }

  async correct(
    user: RequestUser,
    id: string,
    dto: CorrectAttendanceDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const attendance = await this.findAttendanceOrThrow(organisationId, id);

    if (!attendance.clockInServerAt) {
      throw new AppException(
        'Attendance is not active for correction',
        HttpStatus.CONFLICT,
        ErrorCode.ATTENDANCE_NOT_ACTIVE,
      );
    }

    const clockInServerAt = dto.clockInServerAt
      ? new Date(dto.clockInServerAt)
      : attendance.clockInServerAt;
    const clockOutServerAt = dto.clockOutServerAt
      ? new Date(dto.clockOutServerAt)
      : attendance.clockOutServerAt;

    if (!clockOutServerAt) {
      throw new AppException(
        'clockOutServerAt is required for correction totals',
        HttpStatus.BAD_REQUEST,
        ErrorCode.BAD_REQUEST,
      );
    }

    const shift = await this.prisma.shift.findFirstOrThrow({
      where: { id: attendance.shiftId },
    });
    const completedBreakMinutes = await this.sumCompletedBreaks(attendance.id);
    const totals = this.calculationService.calculateTotals({
      clockInServerAt,
      clockOutServerAt,
      scheduledStartAt: shift.scheduledStartAt,
      scheduledEndAt: shift.scheduledEndAt,
      gracePeriodMinutes: shift.gracePeriodMinutes,
      unpaidBreakMinutes: shift.unpaidBreakMinutes,
      overtimeThresholdMinutes: shift.overtimeThresholdMinutes,
      completedBreakMinutes,
    });

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.attendance.update({
        where: { id: attendance.id },
        data: {
          clockInServerAt,
          clockOutServerAt,
          ...totals,
        },
        include: ATTENDANCE_INCLUDE,
      });
      await tx.attendanceEvent.create({
        data: {
          organisationId,
          attendanceId: row.id,
          type: AttendanceEventType.CORRECTED,
          actorUserId: user.id,
          serverTimestamp: now,
          reason: dto.reason.trim(),
          metadata: {
            before: {
              clockInServerAt: attendance.clockInServerAt?.toISOString(),
              clockOutServerAt: attendance.clockOutServerAt?.toISOString(),
              grossMinutes: attendance.grossMinutes,
              payableMinutes: attendance.payableMinutes,
            },
            after: {
              clockInServerAt: clockInServerAt.toISOString(),
              clockOutServerAt: clockOutServerAt.toISOString(),
              ...totals,
            },
          },
        },
      });
      return row;
    });

    await this.auditService.record(
      {
        organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entityId: updated.id,
        metadata: { action: 'correct' },
      },
      ctx,
    );

    return toAttendanceResponse(updated);
  }

  async voidAttendance(
    user: RequestUser,
    id: string,
    dto: AttendanceReasonDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const attendance = await this.findAttendanceOrThrow(organisationId, id);
    assertAttendanceTransition(attendance.status, AttendanceStatus.VOIDED);

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.attendance.update({
        where: { id: attendance.id },
        data: { status: AttendanceStatus.VOIDED },
        include: ATTENDANCE_INCLUDE,
      });
      await tx.attendanceEvent.create({
        data: {
          organisationId,
          attendanceId: row.id,
          type: AttendanceEventType.VOIDED,
          actorUserId: user.id,
          serverTimestamp: now,
          reason: dto.reason.trim(),
        },
      });
      return row;
    });

    await this.auditService.record(
      {
        organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entityId: updated.id,
        metadata: { action: 'void' },
      },
      ctx,
    );

    return toAttendanceResponse(updated);
  }

  private async performClockIn(
    user: RequestUser,
    organisationId: string,
    officerId: string,
    dto: ClockInDto,
    ctx: ServiceRequestContext,
  ) {
    const serverNow = new Date();
    const deviceTimestamp = new Date(dto.deviceTimestamp);
    this.assertDeviceTimeTolerance(deviceTimestamp, serverNow);
    this.geofenceService.validateCoordinates(dto.latitude, dto.longitude);
    await this.assertActiveDevice(user);

    const assignment = await this.prisma.assignment.findFirst({
      where: { id: dto.assignmentId, organisationId },
      include: {
        shift: {
          include: {
            site: true,
            organisation: { select: { timezone: true } },
          },
        },
      },
    });

    if (!assignment || assignment.officerId !== officerId) {
      tenantNotFound(ErrorCode.ASSIGNMENT_NOT_FOUND);
    }

    if (
      assignment.isActive === false ||
      assignment.status === AssignmentStatus.CANCELLED ||
      assignment.status === AssignmentStatus.REASSIGNED ||
      assignment.status === AssignmentStatus.MISSED ||
      (assignment.status === AssignmentStatus.COMPLETED &&
        !isRecurringShift(assignment.shift.recurrenceType))
    ) {
      throw new AppException(
        'Assignment is not valid for clock-in',
        HttpStatus.CONFLICT,
        ErrorCode.ASSIGNMENT_NOT_CURRENT,
      );
    }

    const shift = assignment.shift;
    const site = shift.site;
    const earlyMinutes =
      this.configService.get<number>('attendance.clockInEarlyMinutes') ?? 30;
    const currentWindowMs = 2 * 60 * 60_000;
    const geofenceEnabled = this.isGeofenceEnforcementEnabled();
    const recurrenceInput = {
      recurrenceType: shift.recurrenceType,
      scheduledStartAt: shift.scheduledStartAt,
      scheduledEndAt: shift.scheduledEndAt,
      recurrenceEndAt: shift.recurrenceEndAt,
      recurrenceDaysOfWeek: shift.recurrenceDaysOfWeek,
      timezone: shift.timezone,
      organisationTimezone: shift.organisation?.timezone,
    };
    const dutyWindowMs = Math.max(earlyMinutes * 60_000, currentWindowMs);
    const occurrence = resolveClockInOccurrence(
      recurrenceInput,
      serverNow,
      dutyWindowMs,
      shift.gracePeriodMinutes * 60_000,
      dto.occurrenceDate,
    );

    if (!occurrence) {
      throw new AppException(
        'No assignment occurrence is available for clock-in now',
        HttpStatus.CONFLICT,
        ErrorCode.ASSIGNMENT_NOT_CURRENT,
      );
    }

    const existing = await this.prisma.attendance.findFirst({
      where: {
        organisationId,
        assignmentId: assignment.id,
        occurrenceDate: dateKeyToUtcDate(occurrence.dateKey),
        deletedAt: null,
      },
    });
    if (existing) {
      const alreadyFinished =
        existing.clockOutServerAt != null ||
        existing.status === AttendanceStatus.CLOCKED_OUT ||
        existing.status === AttendanceStatus.PENDING_SUPERVISOR_APPROVAL ||
        existing.status === AttendanceStatus.APPROVED_WITH_WARNING ||
        existing.status === AttendanceStatus.SUPERVISOR_APPROVED;
      throw new AppException(
        alreadyFinished
          ? 'You already completed this shift for today. Clock-in is available again on the next scheduled day.'
          : 'Attendance already exists for this assignment occurrence',
        HttpStatus.CONFLICT,
        ErrorCode.ATTENDANCE_ALREADY_EXISTS,
      );
    }

    const earliest = new Date(
      occurrence.startAt.getTime() - earlyMinutes * 60_000,
    );

    if (serverNow < earliest) {
      throw new AppException(
        'Clock-in is too early for this shift',
        HttpStatus.CONFLICT,
        ErrorCode.ATTENDANCE_CLOCK_IN_TOO_EARLY,
      );
    }
    if (serverNow > occurrence.endAt) {
      throw new AppException(
        'Shift has already ended',
        HttpStatus.CONFLICT,
        ErrorCode.ATTENDANCE_SHIFT_ENDED,
      );
    }
    if (
      geofenceEnabled &&
      dto.accuracyMeters > Number(site.minimumGpsAccuracyMeters)
    ) {
      throw new AppException(
        'GPS accuracy is too low',
        HttpStatus.BAD_REQUEST,
        ErrorCode.ATTENDANCE_GPS_ACCURACY_TOO_LOW,
      );
    }

    if (site.requiresClockInSelfie && !dto.evidenceId) {
      throw new AppException(
        'Clock-in selfie evidence is required',
        HttpStatus.BAD_REQUEST,
        ErrorCode.ATTENDANCE_EVIDENCE_REQUIRED,
      );
    }
    if (site.requiresClockInSelfie && dto.evidenceId) {
      await this.assertSelfieEvidenceOwned(
        organisationId,
        user.id,
        dto.evidenceId,
      );
    }

    const distanceMeters = this.geofenceService.distanceMeters(
      site.latitude,
      site.longitude,
      dto.latitude,
      dto.longitude,
    );
    const geofence = this.geofenceService.applyEnforcement(
      geofenceEnabled,
      this.geofenceService.evaluateGeofence({
        distanceMeters,
        radiusMeters: site.clockInRadiusMeters,
        policy: site.clockInOutsideGeofencePolicy,
        reason: dto.reason,
      }),
    );

    if (!geofenceEnabled) {
      this.logger.log('Clock-in allowed with geofence enforcement disabled');
    }

    if (!geofence.allowed) {
      const reasonMissing =
        site.clockInOutsideGeofencePolicy ===
          GeofencePolicy.ALLOW_WITH_REASON && !trimOrUndefined(dto.reason);
      throw new AppException(
        reasonMissing
          ? 'Reason is required when clocking in outside the geofence'
          : 'Clock-in is outside the allowed geofence',
        HttpStatus.BAD_REQUEST,
        reasonMissing
          ? ErrorCode.ATTENDANCE_REASON_REQUIRED
          : ErrorCode.ATTENDANCE_OUTSIDE_GEOFENCE,
      );
    }

    let status: AttendanceStatus = AttendanceStatus.CLOCKED_IN;
    if (geofenceEnabled && geofence.outside && geofence.requiresReview) {
      status =
        site.clockInOutsideGeofencePolicy === GeofencePolicy.ALLOW_WITH_REASON
          ? AttendanceStatus.APPROVED_WITH_WARNING
          : AttendanceStatus.PENDING_SUPERVISOR_APPROVAL;
    }

    const graceEnd = new Date(
      occurrence.startAt.getTime() + shift.gracePeriodMinutes * 60_000,
    );
    const lateMinutes =
      serverNow > graceEnd
        ? Math.floor((serverNow.getTime() - graceEnd.getTime()) / 60_000)
        : 0;

    const created = await this.prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.create({
        data: {
          organisationId,
          assignmentId: assignment.id,
          occurrenceDate: dateKeyToUtcDate(occurrence.dateKey),
          officerId,
          shiftId: shift.id,
          siteId: site.id,
          status,
          clockInDeviceAt: deviceTimestamp,
          clockInServerAt: serverNow,
          clockInLatitude: new Prisma.Decimal(dto.latitude),
          clockInLongitude: new Prisma.Decimal(dto.longitude),
          clockInAccuracyMeters: new Prisma.Decimal(dto.accuracyMeters),
          clockInDistanceMeters: new Prisma.Decimal(distanceMeters),
          clockInOutsideGeofence: geofence.outside,
          geofenceEnforcementDisabled: !geofenceEnabled,
          clockInReason: trimOrUndefined(dto.reason) ?? null,
          clockInEvidenceId: dto.evidenceId ?? null,
          lateMinutes,
          localAttendanceId: dto.localAttendanceId ?? null,
        },
        include: ATTENDANCE_INCLUDE,
      });

      await tx.attendanceEvent.create({
        data: {
          organisationId,
          attendanceId: attendance.id,
          type: AttendanceEventType.CLOCK_IN,
          actorUserId: user.id,
          deviceId: user.deviceId,
          deviceTimestamp,
          serverTimestamp: serverNow,
          latitude: new Prisma.Decimal(dto.latitude),
          longitude: new Prisma.Decimal(dto.longitude),
          accuracyMeters: new Prisma.Decimal(dto.accuracyMeters),
          distanceMeters: new Prisma.Decimal(distanceMeters),
          reason: trimOrUndefined(dto.reason) ?? null,
          metadata: geofenceEnabled
            ? undefined
            : { geofenceEnforcementDisabled: true },
        },
      });

      if (dto.evidenceId) {
        await tx.evidence.updateMany({
          where: {
            id: dto.evidenceId,
            organisationId,
            uploadedByUserId: user.id,
            deletedAt: null,
          },
          data: { attendanceId: attendance.id },
        });
      }

      if (
        assignment.status === AssignmentStatus.ASSIGNED ||
        assignment.status === AssignmentStatus.CONFIRMED
      ) {
        await tx.assignment.update({
          where: { id: assignment.id },
          data: {
            status: AssignmentStatus.IN_PROGRESS,
            startedAt: serverNow,
          },
        });
        await tx.assignmentEvent.create({
          data: {
            assignmentId: assignment.id,
            actorUserId: user.id,
            previousStatus: assignment.status,
            newStatus: AssignmentStatus.IN_PROGRESS,
            reason: 'Clock-in',
          },
        });
      }

      if (
        shift.status === ShiftStatus.SCHEDULED &&
        !isRecurringShift(shift.recurrenceType)
      ) {
        await tx.shift.update({
          where: { id: shift.id },
          data: { status: ShiftStatus.IN_PROGRESS },
        });
      }

      return attendance;
    });

    await this.auditService.record(
      {
        organisationId,
        actorUserId: user.id,
        action: AuditAction.CREATE,
        entityId: created.id,
        metadata: {
          action: 'clock-in',
          outsideGeofence: geofence.outside,
          geofenceEnforcementDisabled: !geofenceEnabled,
          status,
        },
      },
      ctx,
    );

    return toAttendanceResponse(created);
  }

  private async performClockOut(
    user: RequestUser,
    organisationId: string,
    officerId: string,
    dto: ClockOutDto,
    ctx: ServiceRequestContext,
  ) {
    const serverNow = new Date();
    const deviceTimestamp = new Date(dto.deviceTimestamp);
    this.assertDeviceTimeTolerance(deviceTimestamp, serverNow);
    this.geofenceService.validateCoordinates(dto.latitude, dto.longitude);
    await this.assertActiveDevice(user);

    const attendance = await this.prisma.attendance.findFirst({
      where: {
        id: dto.attendanceId,
        organisationId,
        deletedAt: null,
      },
      include: {
        shift: {
          include: {
            organisation: { select: { timezone: true } },
          },
        },
        site: true,
        assignment: true,
        breaks: true,
      },
    });

    if (!attendance || attendance.officerId !== officerId) {
      tenantNotFound(ErrorCode.ATTENDANCE_NOT_FOUND);
    }

    if (!ACTIVE_ATTENDANCE_STATUSES.includes(attendance.status)) {
      throw new AppException(
        'Attendance is not active',
        HttpStatus.CONFLICT,
        ErrorCode.ATTENDANCE_NOT_ACTIVE,
      );
    }

    const activeBreak = attendance.breaks.find(
      (b) => b.status === BreakStatus.ACTIVE,
    );
    if (activeBreak) {
      throw new AppException(
        'Active break must be ended before clock-out',
        HttpStatus.CONFLICT,
        ErrorCode.ATTENDANCE_ACTIVE_BREAK_EXISTS,
      );
    }

    const site = attendance.site;
    const geofenceEnabled = this.isGeofenceEnforcementEnabled();
    if (
      geofenceEnabled &&
      dto.accuracyMeters > Number(site.minimumGpsAccuracyMeters)
    ) {
      throw new AppException(
        'GPS accuracy is too low',
        HttpStatus.BAD_REQUEST,
        ErrorCode.ATTENDANCE_GPS_ACCURACY_TOO_LOW,
      );
    }

    if (site.requiresClockOutSelfie && !dto.evidenceId) {
      throw new AppException(
        'Clock-out selfie evidence is required',
        HttpStatus.BAD_REQUEST,
        ErrorCode.ATTENDANCE_EVIDENCE_REQUIRED,
      );
    }
    if (site.requiresClockOutSelfie && dto.evidenceId) {
      await this.assertSelfieEvidenceOwned(
        organisationId,
        user.id,
        dto.evidenceId,
      );
    }

    if (site.requiresFinalShiftNote && !trimOrUndefined(dto.finalShiftNote)) {
      throw new AppException(
        'Final shift note is required',
        HttpStatus.BAD_REQUEST,
        ErrorCode.ATTENDANCE_FINAL_NOTE_REQUIRED,
      );
    }

    const distanceMeters = this.geofenceService.distanceMeters(
      site.latitude,
      site.longitude,
      dto.latitude,
      dto.longitude,
    );
    const geofence = this.geofenceService.applyEnforcement(
      geofenceEnabled,
      this.geofenceService.evaluateGeofence({
        distanceMeters,
        radiusMeters: site.clockOutRadiusMeters,
        policy: site.clockOutOutsideGeofencePolicy,
        reason: dto.reason,
      }),
    );

    if (!geofenceEnabled) {
      this.logger.log('Clock-out allowed with geofence enforcement disabled');
    }

    if (!geofence.allowed) {
      const reasonMissing =
        site.clockOutOutsideGeofencePolicy ===
          GeofencePolicy.ALLOW_WITH_REASON && !trimOrUndefined(dto.reason);
      throw new AppException(
        reasonMissing
          ? 'Reason is required when clocking out outside the geofence'
          : 'Clock-out is outside the allowed geofence',
        HttpStatus.BAD_REQUEST,
        reasonMissing
          ? ErrorCode.ATTENDANCE_REASON_REQUIRED
          : ErrorCode.ATTENDANCE_OUTSIDE_GEOFENCE,
      );
    }

    let nextStatus: AttendanceStatus = AttendanceStatus.CLOCKED_OUT;
    if (geofenceEnabled && geofence.outside && geofence.requiresReview) {
      nextStatus = AttendanceStatus.PENDING_SUPERVISOR_APPROVAL;
    }
    assertAttendanceTransition(attendance.status, nextStatus);

    const clockInServerAt = attendance.clockInServerAt!;
    const completedBreakMinutes = attendance.breaks
      .filter((b) => b.status === BreakStatus.COMPLETED)
      .reduce((sum, b) => sum + (b.durationMinutes ?? 0), 0);

    const occurrenceDateKey = attendance.occurrenceDate
      ? attendance.occurrenceDate.toISOString().slice(0, 10)
      : zonedDateKey(
          clockInServerAt,
          resolveTimeZone(
            attendance.shift.timezone,
            attendance.shift.organisation?.timezone,
          ),
        );
    const occurrence = occurrenceOnDate(
      {
        recurrenceType: attendance.shift.recurrenceType,
        scheduledStartAt: attendance.shift.scheduledStartAt,
        scheduledEndAt: attendance.shift.scheduledEndAt,
        recurrenceEndAt: attendance.shift.recurrenceEndAt,
        recurrenceDaysOfWeek: attendance.shift.recurrenceDaysOfWeek,
        timezone: attendance.shift.timezone,
        organisationTimezone: attendance.shift.organisation?.timezone,
      },
      occurrenceDateKey,
    ) ?? {
      startAt: attendance.shift.scheduledStartAt,
      endAt: attendance.shift.scheduledEndAt,
      dateKey: occurrenceDateKey,
    };

    const totals = this.calculationService.calculateTotals({
      clockInServerAt,
      clockOutServerAt: serverNow,
      scheduledStartAt: occurrence.startAt,
      scheduledEndAt: occurrence.endAt,
      gracePeriodMinutes: attendance.shift.gracePeriodMinutes,
      unpaidBreakMinutes: attendance.shift.unpaidBreakMinutes,
      overtimeThresholdMinutes: attendance.shift.overtimeThresholdMinutes,
      completedBreakMinutes,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.attendance.update({
        where: { id: attendance.id },
        data: {
          status: nextStatus,
          clockOutDeviceAt: deviceTimestamp,
          clockOutServerAt: serverNow,
          clockOutLatitude: new Prisma.Decimal(dto.latitude),
          clockOutLongitude: new Prisma.Decimal(dto.longitude),
          clockOutAccuracyMeters: new Prisma.Decimal(dto.accuracyMeters),
          clockOutDistanceMeters: new Prisma.Decimal(distanceMeters),
          clockOutOutsideGeofence: geofence.outside,
          geofenceEnforcementDisabled: !geofenceEnabled,
          clockOutReason: trimOrUndefined(dto.reason) ?? null,
          clockOutEvidenceId: dto.evidenceId ?? null,
          finalShiftNote: trimOrUndefined(dto.finalShiftNote) ?? null,
          ...totals,
          ...(nextStatus === AttendanceStatus.PENDING_SUPERVISOR_APPROVAL
            ? { approvalRequestedAt: serverNow }
            : {}),
        },
        include: ATTENDANCE_INCLUDE,
      });

      await tx.attendanceEvent.create({
        data: {
          organisationId,
          attendanceId: row.id,
          type: AttendanceEventType.CLOCK_OUT,
          actorUserId: user.id,
          deviceId: user.deviceId,
          deviceTimestamp,
          serverTimestamp: serverNow,
          latitude: new Prisma.Decimal(dto.latitude),
          longitude: new Prisma.Decimal(dto.longitude),
          accuracyMeters: new Prisma.Decimal(dto.accuracyMeters),
          distanceMeters: new Prisma.Decimal(distanceMeters),
          reason: trimOrUndefined(dto.reason) ?? null,
        },
      });

      if (dto.evidenceId) {
        await tx.evidence.updateMany({
          where: {
            id: dto.evidenceId,
            organisationId,
            uploadedByUserId: user.id,
            deletedAt: null,
          },
          data: { attendanceId: row.id },
        });
      }

      if (
        attendance.assignment.status === AssignmentStatus.IN_PROGRESS &&
        !isRecurringShift(attendance.shift.recurrenceType)
      ) {
        await tx.assignment.update({
          where: { id: attendance.assignmentId },
          data: {
            status: AssignmentStatus.COMPLETED,
            completedAt: serverNow,
          },
        });
        await tx.assignmentEvent.create({
          data: {
            assignmentId: attendance.assignmentId,
            actorUserId: user.id,
            previousStatus: AssignmentStatus.IN_PROGRESS,
            newStatus: AssignmentStatus.COMPLETED,
            reason: 'Clock-out',
          },
        });
      } else if (
        attendance.assignment.status === AssignmentStatus.IN_PROGRESS &&
        isRecurringShift(attendance.shift.recurrenceType)
      ) {
        await tx.assignment.update({
          where: { id: attendance.assignmentId },
          data: {
            status: AssignmentStatus.CONFIRMED,
          },
        });
        await tx.assignmentEvent.create({
          data: {
            assignmentId: attendance.assignmentId,
            actorUserId: user.id,
            previousStatus: AssignmentStatus.IN_PROGRESS,
            newStatus: AssignmentStatus.CONFIRMED,
            reason: 'Clock-out (recurring assignment remains active)',
          },
        });
      }

      return row;
    });

    await this.auditService.record(
      {
        organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entityId: updated.id,
        metadata: {
          action: 'clock-out',
          outsideGeofence: geofence.outside,
          status: nextStatus,
        },
      },
      ctx,
    );

    return toAttendanceResponse(updated);
  }

  private async review(
    user: RequestUser,
    id: string,
    dto: AttendanceReasonDto,
    nextStatus: AttendanceStatus,
    eventType: AttendanceEventType,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    if (
      !userHasPermission(user, 'attendance:review') &&
      !userHasPermission(user, 'attendance:approve')
    ) {
      throw new AppException(
        'Insufficient permissions',
        HttpStatus.FORBIDDEN,
        ErrorCode.ATTENDANCE_REVIEW_FORBIDDEN,
      );
    }

    const attendance = await this.findAttendanceOrThrow(organisationId, id);
    await this.assertCanReviewAttendance(user, organisationId, attendance);
    assertAttendanceTransition(attendance.status, nextStatus);

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.attendance.update({
        where: { id: attendance.id },
        data: {
          status: nextStatus,
          reviewedAt: now,
          reviewedByUserId: user.id,
          reviewReason: dto.reason.trim(),
        },
        include: ATTENDANCE_INCLUDE,
      });
      await tx.attendanceEvent.create({
        data: {
          organisationId,
          attendanceId: row.id,
          type: eventType,
          actorUserId: user.id,
          serverTimestamp: now,
          reason: dto.reason.trim(),
        },
      });
      return row;
    });

    await this.auditService.record(
      {
        organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entityId: updated.id,
        metadata: { action: eventType.toLowerCase() },
      },
      ctx,
    );

    return toAttendanceResponse(updated);
  }

  private isGeofenceEnforcementEnabled(): boolean {
    return (
      this.configService.get<boolean>('attendance.geofenceEnabled') ?? true
    );
  }

  private assertDeviceTimeTolerance(deviceAt: Date, serverAt: Date): void {
    const toleranceMinutes =
      this.configService.get<number>('attendance.deviceTimeToleranceMinutes') ??
      10;
    const deltaMs = Math.abs(deviceAt.getTime() - serverAt.getTime());
    if (deltaMs > toleranceMinutes * 60_000) {
      throw new AppException(
        'Device timestamp is outside the allowed tolerance',
        HttpStatus.BAD_REQUEST,
        ErrorCode.ATTENDANCE_DEVICE_TIME_INVALID,
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

  private async findAttendanceOrThrow(organisationId: string, id: string) {
    const attendance = await this.prisma.attendance.findFirst({
      where: { id, organisationId, deletedAt: null },
      include: {
        ...ATTENDANCE_INCLUDE,
        assignment: {
          select: {
            id: true,
            status: true,
            officerId: true,
            supervisorId: true,
          },
        },
      },
    });
    if (!attendance) {
      tenantNotFound(ErrorCode.ATTENDANCE_NOT_FOUND);
    }
    return attendance;
  }

  private async assertCanReadAttendance(
    user: RequestUser,
    organisationId: string,
    attendance: {
      officerId: string;
      assignment?: { supervisorId: string | null } | null;
    },
  ): Promise<void> {
    if (userHasPermission(user, 'attendance:read')) {
      return;
    }
    if (userHasPermission(user, 'attendance:read:self')) {
      const officerId = await this.accessService.resolveOfficerProfileId(
        user,
        organisationId,
      );
      if (attendance.officerId === officerId) {
        return;
      }
    }
    if (attendance.assignment) {
      await this.accessService.assertCanReadAssignment(user, organisationId, {
        officerId: attendance.officerId,
        supervisorId: attendance.assignment.supervisorId,
      });
      return;
    }
    tenantNotFound(ErrorCode.ATTENDANCE_NOT_FOUND);
  }

  private async assertCanReviewAttendance(
    user: RequestUser,
    organisationId: string,
    attendance: {
      officerId: string;
      assignment?: { supervisorId: string | null } | null;
    },
  ): Promise<void> {
    if (userHasPermission(user, 'attendance:correct')) {
      return;
    }
    if (attendance.assignment?.supervisorId) {
      const supervisorId = await this.accessService.resolveSupervisorProfileId(
        user,
        organisationId,
      );
      if (supervisorId === attendance.assignment.supervisorId) {
        return;
      }
    }
    const supervisorId = await this.accessService.resolveSupervisorProfileId(
      user,
      organisationId,
    );
    if (supervisorId) {
      const linked = await this.prisma.supervisorOfficer.findFirst({
        where: {
          supervisorId,
          officerId: attendance.officerId,
          organisationId,
          OR: [{ activeUntil: null }, { activeUntil: { gt: new Date() } }],
        },
      });
      if (linked) {
        return;
      }
    }
    throw new AppException(
      'Not authorised to review this attendance',
      HttpStatus.FORBIDDEN,
      ErrorCode.ATTENDANCE_REVIEW_FORBIDDEN,
    );
  }

  private async sumCompletedBreaks(attendanceId: string): Promise<number> {
    const breaks = await this.prisma.shiftBreak.findMany({
      where: { attendanceId, status: BreakStatus.COMPLETED },
      select: { durationMinutes: true },
    });
    return breaks.reduce((sum, b) => sum + (b.durationMinutes ?? 0), 0);
  }
}
