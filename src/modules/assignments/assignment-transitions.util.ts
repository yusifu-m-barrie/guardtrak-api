import { HttpStatus } from '@nestjs/common';
import { AssignmentStatus } from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';

export const ASSIGNMENT_TRANSITIONS: Readonly<
  Partial<
    Record<AssignmentStatus, Readonly<Partial<Record<AssignmentStatus, true>>>>
  >
> = {
  [AssignmentStatus.ASSIGNED]: {
    [AssignmentStatus.CONFIRMED]: true,
    [AssignmentStatus.CANCELLED]: true,
    [AssignmentStatus.REASSIGNED]: true,
    [AssignmentStatus.MISSED]: true,
  },
  [AssignmentStatus.CONFIRMED]: {
    [AssignmentStatus.IN_PROGRESS]: true,
    [AssignmentStatus.CANCELLED]: true,
    [AssignmentStatus.REASSIGNED]: true,
    [AssignmentStatus.MISSED]: true,
  },
  [AssignmentStatus.IN_PROGRESS]: {
    [AssignmentStatus.COMPLETED]: true,
  },
} as const;

/**
 * Assignment statuses that still occupy the officer's schedule for overlap checks.
 * Excludes terminal/non-blocking statuses: CANCELLED, REASSIGNED, MISSED, COMPLETED.
 * COMPLETED is excluded so historical finished shifts do not block future scheduling.
 */
export const ACTIVE_ASSIGNMENT_STATUSES: readonly AssignmentStatus[] = [
  AssignmentStatus.ASSIGNED,
  AssignmentStatus.CONFIRMED,
  AssignmentStatus.IN_PROGRESS,
] as const;

export function assertAssignmentTransition(
  from: AssignmentStatus,
  to: AssignmentStatus,
): void {
  if (!ASSIGNMENT_TRANSITIONS[from]?.[to]) {
    throw new AppException(
      `Assignment status transition from ${from} to ${to} is not allowed`,
      HttpStatus.CONFLICT,
      ErrorCode.ASSIGNMENT_STATUS_TRANSITION_INVALID,
    );
  }
}
