import { HttpStatus } from '@nestjs/common';
import { DeviceStatus } from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';

const ALLOWED_TRANSITIONS: Record<DeviceStatus, DeviceStatus[]> = {
  [DeviceStatus.PENDING]: [DeviceStatus.ACTIVE, DeviceStatus.BLOCKED],
  [DeviceStatus.ACTIVE]: [DeviceStatus.REVOKED, DeviceStatus.BLOCKED],
  [DeviceStatus.REVOKED]: [DeviceStatus.ACTIVE],
  [DeviceStatus.BLOCKED]: [DeviceStatus.ACTIVE],
};

export function assertDeviceTransitionAllowed(
  current: DeviceStatus,
  next: DeviceStatus,
): void {
  const allowed = ALLOWED_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new AppException(
      `Device status transition from ${current} to ${next} is not allowed`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.DEVICE_STATUS_TRANSITION_INVALID,
    );
  }
}

export function requiredPermissionForTransition(
  current: DeviceStatus,
  next: DeviceStatus,
): string {
  if (next === DeviceStatus.ACTIVE) {
    if (current === DeviceStatus.PENDING || current === DeviceStatus.REVOKED) {
      return 'device:approve';
    }
    if (current === DeviceStatus.BLOCKED) {
      return 'device:unblock';
    }
  }

  if (next === DeviceStatus.REVOKED) {
    return 'device:revoke';
  }

  if (next === DeviceStatus.BLOCKED) {
    return 'device:block';
  }

  throw new AppException(
    `Device status transition from ${current} to ${next} is not allowed`,
    HttpStatus.BAD_REQUEST,
    ErrorCode.DEVICE_STATUS_TRANSITION_INVALID,
  );
}

export function shouldRevokeSessions(status: DeviceStatus): boolean {
  return status === DeviceStatus.REVOKED || status === DeviceStatus.BLOCKED;
}

export function isActivationTransition(next: DeviceStatus): boolean {
  return next === DeviceStatus.ACTIVE;
}
