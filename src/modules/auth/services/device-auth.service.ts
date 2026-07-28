import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DevicePlatform,
  DeviceStatus,
  type Device,
} from '../../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/constants/error-codes';
import { HttpStatus } from '@nestjs/common';

export interface DeviceLoginInput {
  organisationId: string;
  userId: string;
  installationId: string;
  platform: DevicePlatform;
  deviceName?: string;
  manufacturer?: string;
  model?: string;
  operatingSystem?: string;
  operatingSystemVersion?: string;
  appVersion?: string;
}

@Injectable()
export class DeviceAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async upsertForLogin(input: DeviceLoginInput): Promise<Device> {
    const existing = await this.prisma.device.findUnique({
      where: { installationId: input.installationId },
    });

    if (existing) {
      if (
        existing.status === DeviceStatus.REVOKED ||
        existing.status === DeviceStatus.BLOCKED
      ) {
        throw new AppException(
          'This device is not permitted to sign in',
          HttpStatus.FORBIDDEN,
          ErrorCode.AUTH_DEVICE_BLOCKED,
        );
      }

      const ownershipMismatch =
        existing.userId !== input.userId ||
        existing.organisationId !== input.organisationId;

      // Live/production: one installationId stays bound to one account.
      // Local/testing: allow the same browser/device to switch accounts freely.
      if (ownershipMismatch && this.enforceDeviceOwnership()) {
        throw new AppException(
          'This device is already registered to another account',
          HttpStatus.FORBIDDEN,
          ErrorCode.AUTH_DEVICE_BLOCKED,
        );
      }

      const nextStatus =
        existing.status === DeviceStatus.PENDING
          ? this.autoApprove()
            ? DeviceStatus.ACTIVE
            : DeviceStatus.PENDING
          : existing.status === DeviceStatus.ACTIVE
            ? DeviceStatus.ACTIVE
            : this.autoApprove()
              ? DeviceStatus.ACTIVE
              : existing.status;
      const activeLogin = nextStatus === DeviceStatus.ACTIVE;

      return this.prisma.device.update({
        where: { id: existing.id },
        data: {
          // Testing: re-bind installation to the account currently signing in.
          ...(ownershipMismatch
            ? {
                userId: input.userId,
                organisationId: input.organisationId,
              }
            : {}),
          platform: input.platform,
          deviceName: input.deviceName ?? existing.deviceName,
          manufacturer: input.manufacturer ?? existing.manufacturer,
          model: input.model ?? existing.model,
          operatingSystem: input.operatingSystem ?? existing.operatingSystem,
          operatingSystemVersion:
            input.operatingSystemVersion ?? existing.operatingSystemVersion,
          appVersion: input.appVersion ?? existing.appVersion,
          lastSeenAt: new Date(),
          status: nextStatus,
          trustedAt:
            activeLogin && !existing.trustedAt
              ? new Date()
              : existing.trustedAt,
          trustScore: activeLogin
            ? Math.min(100, (existing.trustScore ?? 50) + 10)
            : (existing.trustScore ?? 20),
        },
      });
    }

    const status = this.autoApprove()
      ? DeviceStatus.ACTIVE
      : DeviceStatus.PENDING;

    return this.prisma.device.create({
      data: {
        organisationId: input.organisationId,
        userId: input.userId,
        installationId: input.installationId,
        platform: input.platform,
        deviceName: input.deviceName,
        manufacturer: input.manufacturer,
        model: input.model,
        operatingSystem: input.operatingSystem,
        operatingSystemVersion: input.operatingSystemVersion,
        appVersion: input.appVersion,
        status,
        trustedAt: status === DeviceStatus.ACTIVE ? new Date() : null,
        trustScore: status === DeviceStatus.ACTIVE ? 60 : 20,
        lastSeenAt: new Date(),
      },
    });
  }

  private autoApprove(): boolean {
    const configured = this.configService.get<boolean>(
      'auth.newDeviceAutoApprove',
    );
    if (configured !== undefined) {
      return configured;
    }
    const nodeEnv = this.configService.get<string>('app.nodeEnv');
    return nodeEnv === 'development' || nodeEnv === 'test';
  }

  /**
   * Production/staging keep strict 1-device → 1-account binding.
   * Development/test skip it so QA can log in as many users from one browser/phone.
   */
  private enforceDeviceOwnership(): boolean {
    const configured = this.configService.get<boolean>(
      'auth.enforceDeviceOwnership',
    );
    if (configured !== undefined) {
      return configured;
    }
    const nodeEnv = this.configService.get<string>('app.nodeEnv');
    return nodeEnv === 'production' || nodeEnv === 'staging';
  }
}
