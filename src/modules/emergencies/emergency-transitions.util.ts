import { HttpStatus } from '@nestjs/common';
import { EmergencyStatus } from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';

/** API ACTIVE maps to DB CREATED. */
export function toDbEmergencyStatus(status: string): EmergencyStatus {
  if (status === 'ACTIVE') {
    return EmergencyStatus.CREATED;
  }
  if ((Object.values(EmergencyStatus) as string[]).includes(status)) {
    return status as EmergencyStatus;
  }
  throw new AppException(
    `Unknown emergency status: ${status}`,
    HttpStatus.BAD_REQUEST,
    ErrorCode.VALIDATION_ERROR,
  );
}

export function toApiEmergencyStatus(status: EmergencyStatus): string {
  if (status === EmergencyStatus.CREATED) {
    return 'ACTIVE';
  }
  return status;
}

export const EMERGENCY_TRANSITIONS: Readonly<
  Partial<
    Record<EmergencyStatus, Readonly<Partial<Record<EmergencyStatus, true>>>>
  >
> = {
  [EmergencyStatus.CREATED]: {
    [EmergencyStatus.ACCEPTED_FOR_PROCESSING]: true,
    [EmergencyStatus.ACKNOWLEDGED]: true,
    [EmergencyStatus.CANCELLED]: true,
    [EmergencyStatus.FALSE_ALARM]: true,
    [EmergencyStatus.FAILED]: true,
  },
  [EmergencyStatus.ACCEPTED_FOR_PROCESSING]: {
    [EmergencyStatus.ACKNOWLEDGED]: true,
    [EmergencyStatus.RESPONDING]: true,
    [EmergencyStatus.CANCELLED]: true,
    [EmergencyStatus.FALSE_ALARM]: true,
  },
  [EmergencyStatus.ACKNOWLEDGED]: {
    [EmergencyStatus.RESPONDING]: true,
    [EmergencyStatus.RESOLVED]: true,
    [EmergencyStatus.CANCELLED]: true,
    [EmergencyStatus.FALSE_ALARM]: true,
  },
  [EmergencyStatus.RESPONDING]: {
    [EmergencyStatus.RESOLVED]: true,
    [EmergencyStatus.CANCELLED]: true,
    [EmergencyStatus.FALSE_ALARM]: true,
  },
} as const;

export function assertEmergencyTransition(
  from: EmergencyStatus,
  to: EmergencyStatus,
): void {
  if (from === to) {
    return;
  }
  if (!EMERGENCY_TRANSITIONS[from]?.[to]) {
    throw new AppException(
      `Emergency status transition from ${from} to ${to} is not allowed`,
      HttpStatus.CONFLICT,
      ErrorCode.EMERGENCY_STATUS_TRANSITION_INVALID,
    );
  }
}
