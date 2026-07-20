import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AuditAction,
  DeviceStatus,
  Prisma,
} from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { buildPaginationMeta } from '../../common/dto/pagination-meta.dto';
import type { RequestUser } from '../../common/types/request-user.type';
import {
  assertPermission,
  assertSameOrganisation,
  requireOrganisationId,
  userHasPermission,
} from '../../common/tenant/tenant.util';
import {
  assertAllowedSortField,
  normalisePagination,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import { SessionService } from '../auth/services/session.service';
import type { ServiceRequestContext } from '../clients/clients.types';
import type { ListDevicesQueryDto } from './dto/list-devices-query.dto';
import type { UpdateDeviceStatusDto } from './dto/update-device-status.dto';
import {
  assertDeviceTransitionAllowed,
  isActivationTransition,
  requiredPermissionForTransition,
  shouldRevokeSessions,
} from './devices-transitions.util';
import { toDeviceResponse } from './mappers/device.mapper';

const DEVICE_SORT_FIELDS = [
  'createdAt',
  'lastSeenAt',
  'status',
  'platform',
] as const;

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly auditService: AuthAuditService,
  ) {}

  async findMine(user: RequestUser) {
    const organisationId = requireOrganisationId(user);

    const devices = await this.prisma.device.findMany({
      where: { organisationId, userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return devices.map((device) => toDeviceResponse(device));
  }

  async findAll(user: RequestUser, query: ListDevicesQueryDto) {
    const organisationId = requireOrganisationId(user);
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const sortBy = assertAllowedSortField(
      query.sortBy,
      DEVICE_SORT_FIELDS,
      'createdAt',
    );
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.DeviceWhereInput = {
      organisationId,
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.platform ? { platform: query.platform } : {}),
      ...(query.lastSeenFrom || query.lastSeenTo
        ? {
            lastSeenAt: {
              ...(query.lastSeenFrom ? { gte: query.lastSeenFrom } : {}),
              ...(query.lastSeenTo ? { lte: query.lastSeenTo } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { deviceName: { contains: query.search, mode: 'insensitive' } },
              { manufacturer: { contains: query.search, mode: 'insensitive' } },
              { model: { contains: query.search, mode: 'insensitive' } },
              {
                installationId: { contains: query.search, mode: 'insensitive' },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy!]: sortOrder },
      }),
      this.prisma.device.count({ where }),
    ]);

    return {
      data: items.map((device) => toDeviceResponse(device)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findOne(user: RequestUser, id: string) {
    const organisationId = requireOrganisationId(user);
    const device = await this.findDeviceOrThrow(organisationId, id);
    this.assertDeviceAccess(user, device);
    return toDeviceResponse(device);
  }

  async updateStatus(
    user: RequestUser,
    id: string,
    dto: UpdateDeviceStatusDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const device = await this.findDeviceOrThrow(organisationId, id);

    if (device.status === dto.status) {
      return toDeviceResponse(device);
    }

    assertDeviceTransitionAllowed(device.status, dto.status);

    const permission = requiredPermissionForTransition(
      device.status,
      dto.status,
    );
    assertPermission(user, permission);

    if (isActivationTransition(dto.status) && device.userId === user.id) {
      throw new AppException(
        'Users cannot activate or unblock their own devices',
        HttpStatus.FORBIDDEN,
        ErrorCode.DEVICE_ACCESS_FORBIDDEN,
      );
    }

    const now = new Date();
    const updateData: Prisma.DeviceUpdateInput = {
      status: dto.status,
      ...(dto.status === DeviceStatus.ACTIVE
        ? {
            trustedAt: now,
            revokedAt: null,
            trustScore: Math.min(100, (device.trustScore ?? 50) + 10),
          }
        : {}),
      ...(dto.status === DeviceStatus.REVOKED
        ? { revokedAt: now, trustScore: 0 }
        : {}),
      ...(dto.status === DeviceStatus.BLOCKED ? { trustScore: 0 } : {}),
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.device.update({
        where: { id: device.id },
        data: updateData,
      });

      if (shouldRevokeSessions(dto.status)) {
        await tx.refreshSession.updateMany({
          where: { deviceId: device.id, revokedAt: null },
          data: { revokedAt: now },
        });
      }

      return result;
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'Device',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        previousStatus: device.status,
        newStatus: dto.status,
        reason: dto.reason ?? null,
      },
    });

    return toDeviceResponse(updated);
  }

  async retire(
    user: RequestUser,
    id: string,
    ctx: ServiceRequestContext,
  ): Promise<void> {
    const organisationId = requireOrganisationId(user);
    const device = await this.findDeviceOrThrow(organisationId, id);

    if (device.status === DeviceStatus.REVOKED) {
      return;
    }

    assertPermission(user, 'device:revoke');

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.device.update({
        where: { id: device.id },
        data: {
          status: DeviceStatus.REVOKED,
          revokedAt: now,
          trustScore: 0,
        },
      });

      await tx.refreshSession.updateMany({
        where: { deviceId: device.id, revokedAt: null },
        data: { revokedAt: now },
      });
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.DELETE,
      entityType: 'Device',
      entityId: device.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        previousStatus: device.status,
        newStatus: DeviceStatus.REVOKED,
      },
    });
  }

  private async findDeviceOrThrow(organisationId: string, id: string) {
    const device = await this.prisma.device.findFirst({
      where: { id, organisationId },
    });

    if (!device) {
      throw new AppException(
        'Device not found',
        HttpStatus.NOT_FOUND,
        ErrorCode.DEVICE_NOT_FOUND,
      );
    }

    assertSameOrganisation(organisationId, device.organisationId);
    return device;
  }

  private assertDeviceAccess(
    user: RequestUser,
    device: { userId: string },
  ): void {
    if (device.userId === user.id) {
      return;
    }

    if (!userHasPermission(user, 'device:read')) {
      throw new AppException(
        'Insufficient permissions to access this device',
        HttpStatus.FORBIDDEN,
        ErrorCode.DEVICE_ACCESS_FORBIDDEN,
      );
    }
  }
}
