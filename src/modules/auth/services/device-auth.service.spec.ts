/* eslint-disable @typescript-eslint/no-unsafe-member-access -- jest mock call args */
import { ConfigService } from '@nestjs/config';
import {
  DevicePlatform,
  DeviceStatus,
} from '../../../../generated/prisma/client';
import { DeviceAuthService } from './device-auth.service';

describe('DeviceAuthService', () => {
  const prisma = {
    device: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const configService = {
    get: jest.fn(),
  };

  let service: DeviceAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeviceAuthService(
      prisma as never,
      configService as unknown as ConfigService,
    );
  });

  it('creates PENDING devices when AUTH_NEW_DEVICE_AUTO_APPROVE is false', async () => {
    configService.get.mockReturnValue(false);
    prisma.device.findUnique.mockResolvedValue(null);
    prisma.device.create.mockResolvedValue({
      id: 'device-1',
      organisationId: 'org-1',
      userId: 'user-1',
      installationId: 'install-1',
      platform: DevicePlatform.ANDROID,
      status: DeviceStatus.PENDING,
      trustedAt: null,
      trustScore: 20,
    });

    const device = await service.upsertForLogin({
      organisationId: 'org-1',
      userId: 'user-1',
      installationId: 'install-1',
      platform: DevicePlatform.ANDROID,
    });

    expect(device.status).toBe(DeviceStatus.PENDING);
    expect(prisma.device.create).toHaveBeenCalledTimes(1);
    const createArg = prisma.device.create.mock.calls[0][0] as {
      data: { status: DeviceStatus; trustedAt: Date | null };
    };
    expect(createArg.data.status).toBe(DeviceStatus.PENDING);
    expect(createArg.data.trustedAt).toBeNull();
  });

  it('keeps existing PENDING devices pending when auto-approve is false', async () => {
    configService.get.mockReturnValue(false);
    prisma.device.findUnique.mockResolvedValue({
      id: 'device-1',
      organisationId: 'org-1',
      userId: 'user-1',
      status: DeviceStatus.PENDING,
      deviceName: null,
      manufacturer: null,
      model: null,
      operatingSystem: null,
      operatingSystemVersion: null,
      appVersion: null,
      trustedAt: null,
      trustScore: 20,
    });
    prisma.device.update.mockResolvedValue({
      id: 'device-1',
      organisationId: 'org-1',
      userId: 'user-1',
      status: DeviceStatus.PENDING,
      trustedAt: null,
      trustScore: 20,
    });

    const device = await service.upsertForLogin({
      organisationId: 'org-1',
      userId: 'user-1',
      installationId: 'install-1',
      platform: DevicePlatform.ANDROID,
    });

    expect(device.status).toBe(DeviceStatus.PENDING);
    expect(prisma.device.update).toHaveBeenCalledTimes(1);
    const updateArg = prisma.device.update.mock.calls[0][0] as {
      data: { status: DeviceStatus };
    };
    expect(updateArg.data.status).toBe(DeviceStatus.PENDING);
  });
});
