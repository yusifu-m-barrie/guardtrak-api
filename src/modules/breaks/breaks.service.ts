import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  BreakStatus,
  DeviceStatus,
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
  userHasPermission,
} from '../../common/tenant/tenant.util';
import { normalisePagination } from '../../common/utils/pagination.util';
import { trimOrUndefined } from '../../common/utils/normalize.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ACTIVE_ATTENDANCE_STATUSES } from '../attendance/attendance-transitions.util';
import { AssignmentAccessService } from '../assignments/assignment-access.service';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import type { ServiceRequestContext } from '../clients/clients.types';
import { assertBreakTransition } from './break-transitions.util';
import type { CancelBreakDto } from './dto/cancel-break.dto';
import type { EndBreakDto } from './dto/end-break.dto';
import type { ListBreaksQueryDto } from './dto/list-breaks-query.dto';
import type { StartBreakDto } from './dto/start-break.dto';
import { toBreakResponse } from './mappers/break.mapper';

@Injectable()
export class BreaksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly accessService: AssignmentAccessService,
    private readonly auditService: AuthAuditService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async start(
    user: RequestUser,
    dto: StartBreakDto,
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
      type: dto.type,
      deviceTimestamp: dto.deviceTimestamp,
      note: dto.note ?? null,
      localBreakId: dto.localBreakId ?? null,
    });

    const begin = await this.idempotencyService.begin({
      key: dto.idempotencyKey,
      organisationId,
      userId: user.id,
      operation: 'break.start',
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
        error instanceof Error ? error.message : 'break start failed',
      );
      throw error;
    }
  }

  async end(
    user: RequestUser,
    id: string,
    dto: EndBreakDto,
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
      breakId: id,
      deviceTimestamp: dto.deviceTimestamp,
      note: dto.note ?? null,
    });

    const begin = await this.idempotencyService.begin({
      key: dto.idempotencyKey,
      organisationId,
      userId: user.id,
      operation: 'break.end',
      requestHash,
      ttlSeconds: ttl,
    });
    if (begin.replay && begin.record?.responseBody) {
      return begin.record.responseBody;
    }

    try {
      const response = await this.performEnd(
        user,
        organisationId,
        officerId,
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
        error instanceof Error ? error.message : 'break end failed',
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
    const active = await this.prisma.shiftBreak.findFirst({
      where: {
        organisationId,
        officerId,
        status: BreakStatus.ACTIVE,
      },
      orderBy: { startedAtServer: 'desc' },
    });
    return active ? toBreakResponse(active) : null;
  }

  async listMine(user: RequestUser, query: ListBreaksQueryDto) {
    const organisationId = requireOrganisationId(user);
    const officerId = await this.accessService.resolveOfficerProfileId(
      user,
      organisationId,
    );
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const where: Prisma.ShiftBreakWhereInput = {
      organisationId,
      officerId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.from || query.to
        ? {
            startedAtServer: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.shiftBreak.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAtServer: 'desc' },
      }),
      this.prisma.shiftBreak.count({ where }),
    ]);
    return {
      data: items.map((item) => toBreakResponse(item)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async list(user: RequestUser, query: ListBreaksQueryDto) {
    const organisationId = requireOrganisationId(user);
    if (!userHasPermission(user, 'break:read')) {
      throw new AppException(
        'Insufficient permissions',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      );
    }
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const where: Prisma.ShiftBreakWhereInput = {
      organisationId,
      ...(query.officerId ? { officerId: query.officerId } : {}),
      ...(query.attendanceId ? { attendanceId: query.attendanceId } : {}),
      ...(query.shiftId ? { shiftId: query.shiftId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            startedAtServer: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const scope = await this.accessService.resolveSupervisorOperationalScope(
      user,
      organisationId,
    );
    if (scope) {
      where.officerId = this.accessService.emptySafeInFilter(
        query.officerId && scope.officerIds.includes(query.officerId)
          ? [query.officerId]
          : scope.officerIds,
      );
    }
    const [items, total] = await Promise.all([
      this.prisma.shiftBreak.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAtServer: 'desc' },
      }),
      this.prisma.shiftBreak.count({ where }),
    ]);
    return {
      data: items.map((item) => toBreakResponse(item)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(user: RequestUser, id: string) {
    const organisationId = requireOrganisationId(user);
    const breakRow = await this.prisma.shiftBreak.findFirst({
      where: { id, organisationId },
    });
    if (!breakRow) {
      tenantNotFound(ErrorCode.BREAK_NOT_FOUND);
    }

    if (!userHasPermission(user, 'break:read')) {
      const officerId = await this.accessService.resolveOfficerProfileId(
        user,
        organisationId,
      );
      if (breakRow.officerId !== officerId) {
        tenantNotFound(ErrorCode.BREAK_NOT_FOUND);
      }
    }

    return toBreakResponse(breakRow);
  }

  async cancel(
    user: RequestUser,
    id: string,
    dto: CancelBreakDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const breakRow = await this.prisma.shiftBreak.findFirst({
      where: { id, organisationId },
    });
    if (!breakRow) {
      tenantNotFound(ErrorCode.BREAK_NOT_FOUND);
    }

    const isOfficerSelf = userHasPermission(user, 'break:start:self');
    const isReviewer =
      userHasPermission(user, 'break:review') ||
      userHasPermission(user, 'attendance:correct');

    if (!isReviewer) {
      const officerId = await this.accessService.resolveOfficerProfileId(
        user,
        organisationId,
      );
      if (!isOfficerSelf || breakRow.officerId !== officerId) {
        throw new AppException(
          'Break access forbidden',
          HttpStatus.FORBIDDEN,
          ErrorCode.BREAK_ACCESS_FORBIDDEN,
        );
      }
      const ageMs =
        Date.now() -
        (breakRow.startedAtServer ?? breakRow.startedAtDevice).getTime();
      if (ageMs > 5 * 60_000) {
        throw new AppException(
          'Break can only be cancelled shortly after accidental start',
          HttpStatus.CONFLICT,
          ErrorCode.BREAK_STATUS_TRANSITION_INVALID,
        );
      }
    }

    assertBreakTransition(breakRow.status, BreakStatus.CANCELLED);

    const updated = await this.prisma.shiftBreak.update({
      where: { id: breakRow.id },
      data: {
        status: BreakStatus.CANCELLED,
        cancellationReason: trimOrUndefined(dto.reason) ?? 'Cancelled',
        cancelledByUserId: user.id,
      },
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'ShiftBreak',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { action: 'cancel' },
    });

    return toBreakResponse(updated);
  }

  private async performStart(
    user: RequestUser,
    organisationId: string,
    officerId: string,
    dto: StartBreakDto,
    ctx: ServiceRequestContext,
  ) {
    const serverNow = new Date();
    const deviceTimestamp = new Date(dto.deviceTimestamp);
    this.assertDeviceTimeTolerance(deviceTimestamp, serverNow);
    await this.assertActiveDevice(user);

    const attendance = await this.prisma.attendance.findFirst({
      where: {
        id: dto.attendanceId,
        organisationId,
        deletedAt: null,
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

    const existingActive = await this.prisma.shiftBreak.findFirst({
      where: {
        attendanceId: attendance.id,
        status: BreakStatus.ACTIVE,
      },
    });
    if (existingActive) {
      throw new AppException(
        'An active break already exists',
        HttpStatus.CONFLICT,
        ErrorCode.BREAK_ALREADY_ACTIVE,
      );
    }

    const created = await this.prisma.shiftBreak.create({
      data: {
        organisationId,
        attendanceId: attendance.id,
        officerId,
        shiftId: attendance.shiftId,
        type: dto.type,
        status: BreakStatus.ACTIVE,
        startedAtDevice: deviceTimestamp,
        startedAtServer: serverNow,
        note: trimOrUndefined(dto.note) ?? null,
        localBreakId: dto.localBreakId ?? null,
      },
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      entityType: 'ShiftBreak',
      entityId: created.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { action: 'start', type: dto.type },
    });

    return toBreakResponse(created);
  }

  private async performEnd(
    user: RequestUser,
    organisationId: string,
    officerId: string,
    id: string,
    dto: EndBreakDto,
    ctx: ServiceRequestContext,
  ) {
    const serverNow = new Date();
    const deviceTimestamp = new Date(dto.deviceTimestamp);
    this.assertDeviceTimeTolerance(deviceTimestamp, serverNow);
    await this.assertActiveDevice(user);

    const breakRow = await this.prisma.shiftBreak.findFirst({
      where: { id, organisationId },
    });
    if (!breakRow || breakRow.officerId !== officerId) {
      tenantNotFound(ErrorCode.BREAK_NOT_FOUND);
    }
    if (breakRow.status !== BreakStatus.ACTIVE) {
      throw new AppException(
        'Break is not active',
        HttpStatus.CONFLICT,
        ErrorCode.BREAK_NOT_ACTIVE,
      );
    }

    assertBreakTransition(breakRow.status, BreakStatus.COMPLETED);
    const startedAt = breakRow.startedAtServer ?? breakRow.startedAtDevice;
    const durationMinutes = Math.max(
      0,
      Math.floor((serverNow.getTime() - startedAt.getTime()) / 60_000),
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.shiftBreak.update({
        where: { id: breakRow.id },
        data: {
          status: BreakStatus.COMPLETED,
          endedAtDevice: deviceTimestamp,
          endedAtServer: serverNow,
          durationMinutes,
          note: trimOrUndefined(dto.note) ?? breakRow.note,
        },
      });

      const completed = await tx.shiftBreak.findMany({
        where: {
          attendanceId: breakRow.attendanceId,
          status: BreakStatus.COMPLETED,
        },
        select: { durationMinutes: true },
      });
      const totalBreakMinutes = completed.reduce(
        (sum, item) => sum + (item.durationMinutes ?? 0),
        0,
      );
      await tx.attendance.update({
        where: { id: breakRow.attendanceId },
        data: { totalBreakMinutes },
      });

      return row;
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'ShiftBreak',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { action: 'end', durationMinutes },
    });

    return toBreakResponse(updated);
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
}
