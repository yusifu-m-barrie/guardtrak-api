import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  CheckpointStatus,
  CheckpointVerificationMethod,
  DeviceStatus,
  PatrolAssignmentStatus,
  Prisma,
} from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { buildPaginationMeta } from '../../common/dto/pagination-meta.dto';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { hashRequestPayload } from '../../common/idempotency/request-hash.util';
import type { RequestUser } from '../../common/types/request-user.type';
import {
  requireOrganisationId,
  tenantNotFound,
} from '../../common/tenant/tenant.util';
import {
  assertAllowedSortField,
  normalisePagination,
} from '../../common/utils/pagination.util';
import { trimOrUndefined } from '../../common/utils/normalize.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import type { ServiceRequestContext } from '../clients/clients.types';
import { GeofenceService } from '../attendance/geofence.service';
import { SCOPE_NIL_UUID } from '../assignments/assignment-access.service';
import { PatrolAccessService } from '../patrols/patrol-access.service';
import { PatrolProgressService } from '../patrols/patrol-progress.service';
import { verifyQrCode } from '../patrols/patrol-qr.util';
import type { CreatePatrolVisitDto } from './dto/create-patrol-visit.dto';
import type { ListMyPatrolVisitsQueryDto } from './dto/list-my-patrol-visits-query.dto';
import type { ListPatrolVisitsQueryDto } from './dto/list-patrol-visits-query.dto';
import type { OverridePatrolVisitDto } from './dto/override-patrol-visit.dto';
import type { ReviewPatrolVisitDto } from './dto/review-patrol-visit.dto';
import { toPatrolVisitResponse } from './mappers/patrol-visit.mapper';

const VISIT_SORT = ['visitedAtServer', 'createdAt'] as const;

const VISIT_INCLUDE = {
  assignmentCheckpoint: true,
  patrolAssignment: {
    select: {
      id: true,
      status: true,
      patrolRouteId: true,
      officerId: true,
    },
  },
} satisfies Prisma.PatrolVisitInclude;

@Injectable()
export class PatrolVisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuthAuditService,
    private readonly configService: ConfigService,
    private readonly geofenceService: GeofenceService,
    private readonly accessService: PatrolAccessService,
    private readonly progressService: PatrolProgressService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async createVisit(
    user: RequestUser,
    patrolAssignmentId: string,
    checkpointId: string,
    dto: CreatePatrolVisitDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const ttl =
      this.configService.get<number>('patrol.idempotencyTtlSeconds') ?? 86_400;
    const requestHash = hashRequestPayload({
      patrolAssignmentId,
      checkpointId,
      verificationMethod: dto.verificationMethod,
      deviceTimestamp: dto.deviceTimestamp,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracyMeters: dto.accuracyMeters,
      note: dto.note ?? null,
      evidenceId: dto.evidenceId ?? null,
      localVisitId: dto.localVisitId ?? null,
      hasQr: Boolean(dto.qrCodeValue),
    });

    const begin = await this.idempotencyService.begin({
      key: dto.idempotencyKey,
      organisationId,
      userId: user.id,
      operation: 'patrol.visit',
      requestHash,
      ttlSeconds: ttl,
    });
    if (begin.replay && begin.record?.responseBody) {
      return begin.record.responseBody;
    }

    try {
      const response = await this.performVisit(
        user,
        organisationId,
        patrolAssignmentId,
        checkpointId,
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
        error instanceof Error ? error.message : 'patrol visit failed',
      );
      throw error;
    }
  }

  async listMine(user: RequestUser, query: ListMyPatrolVisitsQueryDto) {
    const organisationId = requireOrganisationId(user);
    const officerId = await this.accessService.resolveOfficerProfileId(
      user,
      organisationId,
    );
    if (!officerId) {
      tenantNotFound(ErrorCode.PATROL_VISIT_NOT_FOUND);
    }
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const where: Prisma.PatrolVisitWhereInput = {
      organisationId,
      officerId,
      ...(query.patrolAssignmentId
        ? { patrolAssignmentId: query.patrolAssignmentId }
        : {}),
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            visitedAtServer: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.patrolVisit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { visitedAtServer: 'desc' },
        include: VISIT_INCLUDE,
      }),
      this.prisma.patrolVisit.count({ where }),
    ]);

    return {
      data: items.map((v) => toPatrolVisitResponse(v)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findAll(user: RequestUser, query: ListPatrolVisitsQueryDto) {
    const organisationId = requireOrganisationId(user);
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const sortBy = assertAllowedSortField(
      query.sortBy,
      VISIT_SORT,
      'visitedAtServer',
    );
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.PatrolVisitWhereInput = {
      organisationId,
      ...(query.patrolAssignmentId
        ? { patrolAssignmentId: query.patrolAssignmentId }
        : {}),
      ...(query.officerId ? { officerId: query.officerId } : {}),
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.routeId
        ? { patrolAssignment: { patrolRouteId: query.routeId } }
        : {}),
      ...(query.checkpointId
        ? {
            OR: [
              { assignmentCheckpointId: query.checkpointId },
              { patrolCheckpointId: query.checkpointId },
              {
                assignmentCheckpoint: {
                  sourceCheckpointId: query.checkpointId,
                },
              },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.verificationMethod
        ? { verificationMethod: query.verificationMethod }
        : {}),
      ...(query.from || query.to
        ? {
            visitedAtServer: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    if (user.role === 'SUPERVISOR') {
      const supervisorId = await this.accessService.resolveSupervisorProfileId(
        user,
        organisationId,
      );
      const officerIds = supervisorId
        ? await this.accessService.listAssignedOfficerIds(
            organisationId,
            supervisorId,
          )
        : [];
      const allowed =
        query.officerId && officerIds.includes(query.officerId)
          ? [query.officerId]
          : officerIds;
      where.officerId = {
        in: allowed.length > 0 ? allowed : [SCOPE_NIL_UUID],
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.patrolVisit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy!]: sortOrder },
        include: VISIT_INCLUDE,
      }),
      this.prisma.patrolVisit.count({ where }),
    ]);

    return {
      data: items.map((v) => toPatrolVisitResponse(v)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(user: RequestUser, id: string) {
    const organisationId = requireOrganisationId(user);
    const visit = await this.prisma.patrolVisit.findFirst({
      where: { id, organisationId },
      include: VISIT_INCLUDE,
    });
    if (!visit) {
      tenantNotFound(ErrorCode.PATROL_VISIT_NOT_FOUND);
    }
    await this.accessService.assertCanReadPatrolAssignment(
      user,
      organisationId,
      { officerId: visit.officerId, siteId: visit.siteId },
    );
    return toPatrolVisitResponse(visit);
  }

  async approve(
    user: RequestUser,
    id: string,
    dto: ReviewPatrolVisitDto,
    ctx: ServiceRequestContext,
  ) {
    return this.reviewVisit(
      user,
      id,
      CheckpointStatus.COMPLETED,
      dto.reason,
      ctx,
      'approve',
    );
  }

  async reject(
    user: RequestUser,
    id: string,
    dto: ReviewPatrolVisitDto,
    ctx: ServiceRequestContext,
  ) {
    return this.reviewVisit(
      user,
      id,
      CheckpointStatus.MISSED,
      dto.reason,
      ctx,
      'reject',
    );
  }

  async override(
    user: RequestUser,
    id: string,
    dto: OverridePatrolVisitDto,
    ctx: ServiceRequestContext,
  ) {
    const markAs = dto.markAs ?? CheckpointStatus.COMPLETED;
    if (
      markAs !== CheckpointStatus.COMPLETED &&
      markAs !== CheckpointStatus.SKIPPED &&
      markAs !== CheckpointStatus.MISSED
    ) {
      throw new AppException(
        'Invalid override status',
        HttpStatus.BAD_REQUEST,
        ErrorCode.PATROL_VISIT_VERIFICATION_METHOD_INVALID,
      );
    }
    return this.reviewVisit(user, id, markAs, dto.reason, ctx, 'override');
  }

  private async performVisit(
    user: RequestUser,
    organisationId: string,
    patrolAssignmentId: string,
    checkpointId: string,
    dto: CreatePatrolVisitDto,
    ctx: ServiceRequestContext,
  ) {
    const officerId = await this.accessService.resolveOfficerProfileId(
      user,
      organisationId,
    );
    if (!officerId) {
      tenantNotFound(ErrorCode.PATROL_ASSIGNMENT_NOT_FOUND);
    }

    const patrol = await this.prisma.patrolAssignment.findFirst({
      where: { id: patrolAssignmentId, organisationId },
      include: {
        patrolRoute: {
          select: { requireSequentialCompletion: true },
        },
        checkpointSnapshots: { orderBy: { sequence: 'asc' } },
        visits: {
          select: {
            assignmentCheckpointId: true,
            status: true,
            patrolCheckpointId: true,
          },
        },
      },
    });
    if (!patrol || patrol.officerId !== officerId) {
      tenantNotFound(ErrorCode.PATROL_ASSIGNMENT_NOT_FOUND);
    }
    if (patrol.status !== PatrolAssignmentStatus.IN_PROGRESS) {
      throw new AppException(
        'Patrol assignment must be in progress to record a visit',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_ASSIGNMENT_STATUS_INVALID,
      );
    }

    const snapshot =
      patrol.checkpointSnapshots.find((s) => s.id === checkpointId) ??
      patrol.checkpointSnapshots.find(
        (s) => s.sourceCheckpointId === checkpointId,
      );
    if (!snapshot) {
      tenantNotFound(ErrorCode.PATROL_CHECKPOINT_NOT_FOUND);
    }

    const existingVisit = patrol.visits.find(
      (v) => v.assignmentCheckpointId === snapshot.id,
    );
    if (
      existingVisit &&
      (existingVisit.status === CheckpointStatus.COMPLETED ||
        existingVisit.status === CheckpointStatus.SKIPPED)
    ) {
      throw new AppException(
        'Checkpoint already completed for this patrol',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_CHECKPOINT_ALREADY_COMPLETED,
      );
    }

    if (patrol.patrolRoute.requireSequentialCompletion) {
      const progress = this.progressService.calculate(
        patrol.checkpointSnapshots,
        patrol.visits,
      );
      if (
        progress.nextCheckpoint &&
        progress.nextCheckpoint.id !== snapshot.id
      ) {
        throw new AppException(
          'Checkpoints must be completed in sequence',
          HttpStatus.CONFLICT,
          ErrorCode.PATROL_CHECKPOINT_OUT_OF_ORDER,
        );
      }
    }

    if (
      dto.verificationMethod ===
      CheckpointVerificationMethod.MANUAL_SUPERVISOR_OVERRIDE
    ) {
      throw new AppException(
        'Officers cannot use MANUAL_SUPERVISOR_OVERRIDE',
        HttpStatus.BAD_REQUEST,
        ErrorCode.PATROL_VISIT_VERIFICATION_METHOD_INVALID,
      );
    }
    if (dto.verificationMethod !== snapshot.verificationMethod) {
      throw new AppException(
        'Submitted verification method does not match checkpoint configuration',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_VISIT_VERIFICATION_METHOD_INVALID,
      );
    }

    const serverNow = new Date();
    const deviceTimestamp = new Date(dto.deviceTimestamp);
    this.assertDeviceTimeTolerance(deviceTimestamp, serverNow);
    await this.assertActiveDevice(user);
    this.geofenceService.validateCoordinates(dto.latitude, dto.longitude);

    const minAccuracy = snapshot.minimumGpsAccuracyMeters ?? 50;
    if (dto.accuracyMeters > minAccuracy) {
      throw new AppException(
        'GPS accuracy is too low for checkpoint verification',
        HttpStatus.BAD_REQUEST,
        ErrorCode.PATROL_VISIT_GPS_ACCURACY_TOO_LOW,
      );
    }

    const distanceMeters = this.geofenceService.distanceMeters(
      dto.latitude,
      dto.longitude,
      Number(snapshot.latitude),
      Number(snapshot.longitude),
    );

    const method = snapshot.verificationMethod;
    const needsGps =
      method === CheckpointVerificationMethod.GPS ||
      method === CheckpointVerificationMethod.GPS_AND_QR;
    const needsQr =
      method === CheckpointVerificationMethod.QR_CODE ||
      method === CheckpointVerificationMethod.GPS_AND_QR;

    // Allow a small GPS accuracy buffer so noisy phone GPS near the pin still passes.
    const accuracyBuffer = Math.min(Math.max(dto.accuracyMeters ?? 0, 0), 25);
    const effectiveRadius = snapshot.allowedRadiusMeters + accuracyBuffer;

    if (needsGps && distanceMeters > effectiveRadius) {
      throw new AppException(
        `Visit is outside the checkpoint geofence (${Math.round(distanceMeters)} m away, allowed ${snapshot.allowedRadiusMeters} m)`,
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_VISIT_OUTSIDE_GEOFENCE,
      );
    }

    if (needsQr && !verifyQrCode(dto.qrCodeValue, snapshot.qrCodeHash)) {
      throw new AppException(
        'QR code verification failed',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_VISIT_QR_INVALID,
      );
    }

    if (snapshot.requiresPhoto && !dto.evidenceId) {
      throw new AppException(
        'Evidence is required for this checkpoint',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_VISIT_EVIDENCE_REQUIRED,
      );
    }
    if (snapshot.requiresNote && !trimOrUndefined(dto.note)) {
      throw new AppException(
        'Note is required for this checkpoint',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_VISIT_NOTE_REQUIRED,
      );
    }

    const offlineThreshold =
      this.configService.get<number>('patrol.offlineReviewThresholdMinutes') ??
      30;
    const offlineMs = Math.abs(deviceTimestamp.getTime() - serverNow.getTime());
    const status =
      offlineMs > offlineThreshold * 60_000
        ? CheckpointStatus.REQUIRES_REVIEW
        : CheckpointStatus.COMPLETED;

    const visit = await this.prisma.$transaction(async (tx) => {
      const created = existingVisit
        ? await tx.patrolVisit.update({
            where: {
              patrolAssignmentId_assignmentCheckpointId: {
                patrolAssignmentId: patrol.id,
                assignmentCheckpointId: snapshot.id,
              },
            },
            data: {
              status,
              verificationMethod: method,
              visitedAtDevice: deviceTimestamp,
              visitedAtServer: serverNow,
              latitude: new Prisma.Decimal(dto.latitude),
              longitude: new Prisma.Decimal(dto.longitude),
              accuracyMeters: new Prisma.Decimal(dto.accuracyMeters),
              distanceMeters: new Prisma.Decimal(distanceMeters),
              note: trimOrUndefined(dto.note) ?? null,
              evidenceId: dto.evidenceId ?? null,
              localVisitId: trimOrUndefined(dto.localVisitId) ?? null,
              patrolCheckpointId: snapshot.sourceCheckpointId,
            },
            include: VISIT_INCLUDE,
          })
        : await tx.patrolVisit.create({
            data: {
              organisationId,
              patrolAssignmentId: patrol.id,
              patrolCheckpointId: snapshot.sourceCheckpointId,
              assignmentCheckpointId: snapshot.id,
              officerId: patrol.officerId,
              shiftId: patrol.shiftId,
              siteId: patrol.siteId,
              status,
              verificationMethod: method,
              visitedAtDevice: deviceTimestamp,
              visitedAtServer: serverNow,
              latitude: new Prisma.Decimal(dto.latitude),
              longitude: new Prisma.Decimal(dto.longitude),
              accuracyMeters: new Prisma.Decimal(dto.accuracyMeters),
              distanceMeters: new Prisma.Decimal(distanceMeters),
              note: trimOrUndefined(dto.note) ?? null,
              evidenceId: dto.evidenceId ?? null,
              localVisitId: trimOrUndefined(dto.localVisitId) ?? null,
            },
            include: VISIT_INCLUDE,
          });

      const allVisits = await tx.patrolVisit.findMany({
        where: { patrolAssignmentId: patrol.id },
        select: {
          assignmentCheckpointId: true,
          status: true,
          patrolCheckpointId: true,
        },
      });
      const progress = this.progressService.calculate(
        patrol.checkpointSnapshots,
        allVisits,
      );
      await tx.patrolAssignment.update({
        where: { id: patrol.id },
        data: {
          completedCheckpointCount: progress.completedCheckpoints,
          totalCheckpointCount: progress.totalCheckpoints,
          ...(progress.reviewRequiredCheckpoints > 0
            ? { status: PatrolAssignmentStatus.REQUIRES_REVIEW }
            : {}),
        },
      });

      return created;
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      entityType: 'PatrolVisit',
      entityId: visit.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        patrolAssignmentId: patrol.id,
        assignmentCheckpointId: snapshot.id,
        status,
      },
    });

    return toPatrolVisitResponse(visit);
  }

  private async reviewVisit(
    user: RequestUser,
    id: string,
    nextStatus: CheckpointStatus,
    reasonRaw: string,
    ctx: ServiceRequestContext,
    action: 'approve' | 'reject' | 'override',
  ) {
    const organisationId = requireOrganisationId(user);
    const reason = trimOrUndefined(reasonRaw);
    if (!reason) {
      throw new AppException(
        'Review reason is required',
        HttpStatus.BAD_REQUEST,
        ErrorCode.PATROL_VISIT_NOTE_REQUIRED,
      );
    }

    const visit = await this.prisma.patrolVisit.findFirst({
      where: { id, organisationId },
      include: {
        ...VISIT_INCLUDE,
        patrolAssignment: {
          include: {
            checkpointSnapshots: { orderBy: { sequence: 'asc' } },
            visits: {
              select: {
                assignmentCheckpointId: true,
                status: true,
                patrolCheckpointId: true,
              },
            },
          },
        },
      },
    });
    if (!visit) {
      tenantNotFound(ErrorCode.PATROL_VISIT_NOT_FOUND);
    }

    await this.accessService.assertCanReviewPatrol(user, organisationId, {
      officerId: visit.officerId,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.patrolVisit.update({
        where: { id: visit.id },
        data: {
          status: nextStatus,
          reviewedAt: new Date(),
          reviewedByUserId: user.id,
          reviewReason: reason,
          ...(action === 'override'
            ? {
                verificationMethod:
                  CheckpointVerificationMethod.MANUAL_SUPERVISOR_OVERRIDE,
              }
            : {}),
        },
        include: VISIT_INCLUDE,
      });

      const allVisits = await tx.patrolVisit.findMany({
        where: { patrolAssignmentId: visit.patrolAssignmentId },
        select: {
          assignmentCheckpointId: true,
          status: true,
          patrolCheckpointId: true,
        },
      });
      const snapshots =
        visit.patrolAssignment?.checkpointSnapshots ??
        (await tx.patrolAssignmentCheckpoint.findMany({
          where: { patrolAssignmentId: visit.patrolAssignmentId },
          orderBy: { sequence: 'asc' },
        }));
      const progress = this.progressService.calculate(snapshots, allVisits);
      const assignmentStatus = visit.patrolAssignment?.status;
      await tx.patrolAssignment.update({
        where: { id: visit.patrolAssignmentId },
        data: {
          completedCheckpointCount: progress.completedCheckpoints,
          totalCheckpointCount: progress.totalCheckpoints,
          ...(assignmentStatus === PatrolAssignmentStatus.REQUIRES_REVIEW &&
          progress.reviewRequiredCheckpoints === 0
            ? { status: PatrolAssignmentStatus.IN_PROGRESS }
            : {}),
        },
      });

      await tx.patrolAssignmentEvent.create({
        data: {
          patrolAssignmentId: visit.patrolAssignmentId,
          actorUserId: user.id,
          previousStatus: assignmentStatus ?? null,
          newStatus: assignmentStatus ?? PatrolAssignmentStatus.IN_PROGRESS,
          reason: `Visit ${action}: ${reason}`,
        },
      });

      return row;
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'PatrolVisit',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { action, status: nextStatus },
    });

    return toPatrolVisitResponse(updated);
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
}
