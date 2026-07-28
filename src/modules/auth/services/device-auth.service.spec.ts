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

  it('auto-approves WEB devices even when AUTH_NEW_DEVICE_AUTO_APPROVE is false', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'auth.newDeviceAutoApprove') return false;
      if (key === 'auth.webDeviceAutoApprove') return true;
      return undefined;
    });
    prisma.device.findUnique.mockResolvedValue(null);
    prisma.device.create.mockResolvedValue({
      id: 'device-web',
      organisationId: 'org-1',
      userId: 'user-1',
      installationId: 'web-install-1',
      platform: DevicePlatform.WEB,
      status: DeviceStatus.ACTIVE,
      trustedAt: new Date(),
      trustScore: 60,
    });

    const device = await service.upsertForLogin({
      organisationId: 'org-1',
      userId: 'user-1',
      installationId: 'web-install-1',
      platform: DevicePlatform.WEB,
    });

    expect(device.status).toBe(DeviceStatus.ACTIVE);
    const createArg = prisma.device.create.mock.calls[0][0] as {
      data: { status: DeviceStatus };
    };
    expect(createArg.data.status).toBe(DeviceStatus.ACTIVE);
  });

  it('creates PENDING devices when AUTH_NEW_DEVICE_AUTO_APPROVE is false', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'auth.newDeviceAutoApprove') return false;
      if (key === 'auth.webDeviceAutoApprove') return true;
      return undefined;
    });
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
    configService.get.mockImplementation((key: string) => {
      if (key === 'auth.newDeviceAutoApprove') return false;
      if (key === 'auth.enforceDeviceOwnership') return true;
      return undefined;
    });
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

  it('rejects ownership mismatch when enforceDeviceOwnership is true', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'auth.enforceDeviceOwnership') return true;
      if (key === 'auth.newDeviceAutoApprove') return true;
      return undefined;
    });
    prisma.device.findUnique.mockResolvedValue({
      id: 'device-1',
      organisationId: 'org-1',
      userId: 'user-owner',
      status: DeviceStatus.ACTIVE,
      deviceName: null,
      manufacturer: null,
      model: null,
      operatingSystem: null,
      operatingSystemVersion: null,
      appVersion: null,
      trustedAt: new Date(),
      trustScore: 60,
    });

    await expect(
      service.upsertForLogin({
        organisationId: 'org-1',
        userId: 'user-other',
        installationId: 'install-1',
        platform: DevicePlatform.WEB,
      }),
    ).rejects.toMatchObject({
      message: 'This device is already registered to another account',
    });
  });

  it('rebinds device to new user when enforceDeviceOwnership is false', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'auth.enforceDeviceOwnership') return false;
      if (key === 'auth.newDeviceAutoApprove') return true;
      return undefined;
    });
    prisma.device.findUnique.mockResolvedValue({
      id: 'device-1',
      organisationId: 'org-1',
      userId: 'user-owner',
      status: DeviceStatus.ACTIVE,
      deviceName: null,
      manufacturer: null,
      model: null,
      operatingSystem: null,
      operatingSystemVersion: null,
      appVersion: null,
      trustedAt: new Date(),
      trustScore: 60,
    });
    prisma.device.update.mockResolvedValue({
      id: 'device-1',
      organisationId: 'org-1',
      userId: 'user-other',
      status: DeviceStatus.ACTIVE,
    });

    await service.upsertForLogin({
      organisationId: 'org-1',
      userId: 'user-other',
      installationId: 'install-1',
      platform: DevicePlatform.WEB,
    });

    const updateArg = prisma.device.update.mock.calls[0][0] as {
      data: { userId: string };
    };
    expect(updateArg.data.userId).toBe('user-other');
  });
});
