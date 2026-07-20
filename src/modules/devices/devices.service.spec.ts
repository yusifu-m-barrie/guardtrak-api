import { HttpStatus } from '@nestjs/common';
import { DeviceStatus } from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import type { RequestUser } from '../../common/types/request-user.type';
import {
  assertDeviceTransitionAllowed,
  requiredPermissionForTransition,
  shouldRevokeSessions,
} from './devices-transitions.util';
import { DevicesService } from './devices.service';

describe('devices-transitions.util', () => {
  it('allows PENDING to ACTIVE', () => {
    expect(() =>
      assertDeviceTransitionAllowed(DeviceStatus.PENDING, DeviceStatus.ACTIVE),
    ).not.toThrow();
    expect(
      requiredPermissionForTransition(
        DeviceStatus.PENDING,
        DeviceStatus.ACTIVE,
      ),
    ).toBe('device:approve');
  });

  it('allows ACTIVE to REVOKED with revoke permission', () => {
    expect(
      requiredPermissionForTransition(
        DeviceStatus.ACTIVE,
        DeviceStatus.REVOKED,
      ),
    ).toBe('device:revoke');
    expect(shouldRevokeSessions(DeviceStatus.REVOKED)).toBe(true);
  });

  it('allows BLOCKED to ACTIVE with unblock permission', () => {
    expect(
      requiredPermissionForTransition(
        DeviceStatus.BLOCKED,
        DeviceStatus.ACTIVE,
      ),
    ).toBe('device:unblock');
  });

  it('rejects invalid transitions', () => {
    expect(() =>
      assertDeviceTransitionAllowed(DeviceStatus.REVOKED, DeviceStatus.BLOCKED),
    ).toThrow(AppException);

    try {
      assertDeviceTransitionAllowed(DeviceStatus.REVOKED, DeviceStatus.BLOCKED);
    } catch (error) {
      expect((error as AppException).getResponse()).toMatchObject({
        code: ErrorCode.DEVICE_STATUS_TRANSITION_INVALID,
      });
      expect((error as AppException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });
});

describe('DevicesService', () => {
  const organisationId = 'org-1';
  const deviceId = 'device-1';

  const admin: RequestUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: UserRole.ADMINISTRATOR,
    accountStatus: AccountStatus.ACTIVE,
    organisationId,
    employeeId: 'ADM-001',
    sessionId: 'session-1',
    deviceId: null,
    permissions: ['device:approve', 'device:revoke', 'device:block'],
  };

  const officer: RequestUser = {
    id: 'officer-1',
    email: 'officer@example.com',
    role: UserRole.SECURITY_OFFICER,
    accountStatus: AccountStatus.ACTIVE,
    organisationId,
    employeeId: 'OFF-001',
    sessionId: 'session-2',
    deviceId,
    permissions: ['device:approve'],
  };

  const prisma = {
    device: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const sessionService = {
    revokeAllForDevice: jest.fn(),
  };

  const auditService = {
    record: jest.fn(),
  };

  const service = new DevicesService(
    prisma as never,
    sessionService as never,
    auditService as never,
  );

  type TxFn = (tx: {
    device: { update: jest.Mock };
    refreshSession: { updateMany: jest.Mock };
  }) => unknown;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((fn: TxFn) =>
      Promise.resolve(
        fn({
          device: prisma.device,
          refreshSession: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        }),
      ),
    );
  });

  it('revokes sessions when device is blocked', async () => {
    const refreshUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation((fn: TxFn) =>
      Promise.resolve(
        fn({
          device: {
            update: jest.fn().mockResolvedValue({
              id: deviceId,
              userId: 'other-user',
              organisationId,
              status: DeviceStatus.BLOCKED,
              installationId: 'install-blocked',
              platform: 'ANDROID',
              deviceName: null,
              manufacturer: null,
              model: null,
              operatingSystem: null,
              operatingSystemVersion: null,
              appVersion: null,
              trustedAt: null,
              revokedAt: new Date(),
              lastSeenAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
          refreshSession: { updateMany: refreshUpdateMany },
        }),
      ),
    );

    prisma.device.findFirst.mockResolvedValue({
      id: deviceId,
      organisationId,
      userId: 'other-user',
      status: DeviceStatus.ACTIVE,
    });

    await service.updateStatus(
      admin,
      deviceId,
      { status: DeviceStatus.BLOCKED },
      {},
    );

    expect(refreshUpdateMany).toHaveBeenCalled();
    const updateCalls = refreshUpdateMany.mock.calls as unknown as Array<
      [
        {
          where: { deviceId: string; revokedAt: null };
          data: { revokedAt: Date };
        },
      ]
    >;
    const updateArg = updateCalls[0][0];
    expect(updateArg.where).toEqual({ deviceId, revokedAt: null });
    expect(updateArg.data.revokedAt).toBeInstanceOf(Date);
  });

  it('prevents users from activating their own devices', async () => {
    prisma.device.findFirst.mockResolvedValue({
      id: deviceId,
      organisationId,
      userId: officer.id,
      status: DeviceStatus.PENDING,
    });

    await expect(
      service.updateStatus(
        officer,
        deviceId,
        { status: DeviceStatus.ACTIVE },
        {},
      ),
    ).rejects.toBeInstanceOf(AppException);

    try {
      await service.updateStatus(
        officer,
        deviceId,
        { status: DeviceStatus.ACTIVE },
        {},
      );
    } catch (error) {
      expect((error as AppException).getResponse()).toMatchObject({
        code: ErrorCode.DEVICE_ACCESS_FORBIDDEN,
      });
      expect((error as AppException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('sets trustedAt when activating device', async () => {
    const deviceUpdate = jest.fn().mockResolvedValue({
      id: deviceId,
      userId: 'other-user',
      status: DeviceStatus.ACTIVE,
      installationId: 'install-1',
      platform: 'ANDROID',
      createdAt: new Date(),
      updatedAt: new Date(),
      trustedAt: new Date(),
      revokedAt: null,
      lastSeenAt: null,
      deviceName: null,
      manufacturer: null,
      model: null,
      operatingSystem: null,
      operatingSystemVersion: null,
      appVersion: null,
    });

    prisma.$transaction.mockImplementation((fn: TxFn) =>
      Promise.resolve(
        fn({
          device: { update: deviceUpdate },
          refreshSession: { updateMany: jest.fn() },
        }),
      ),
    );

    prisma.device.findFirst.mockResolvedValue({
      id: deviceId,
      organisationId,
      userId: 'other-user',
      status: DeviceStatus.PENDING,
    });

    await service.updateStatus(
      admin,
      deviceId,
      { status: DeviceStatus.ACTIVE },
      {},
    );

    expect(deviceUpdate).toHaveBeenCalled();
    const updateCalls = deviceUpdate.mock.calls as unknown as Array<
      [
        {
          where: { id: string };
          data: {
            status: DeviceStatus;
            trustedAt: Date;
            revokedAt: null;
          };
        },
      ]
    >;
    const updateArg = updateCalls[0][0];
    expect(updateArg.where.id).toBe(deviceId);
    expect(updateArg.data.status).toBe(DeviceStatus.ACTIVE);
    expect(updateArg.data.trustedAt).toBeInstanceOf(Date);
    expect(updateArg.data.revokedAt).toBeNull();
  });
});
