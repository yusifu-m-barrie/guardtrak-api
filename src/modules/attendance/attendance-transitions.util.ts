import { HttpStatus } from '@nestjs/common';
import { AttendanceStatus } from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';

/**
 * Allowed attendance status transitions for GuardTrak Phase 5.
 *
 * ## Clock-in result statuses (from PENDING)
 * - PENDING → CLOCKED_IN — inside geofence, no review required
 * - PENDING → PENDING_SUPERVISOR_APPROVAL — outside geofence with REQUIRE_SUPERVISOR_APPROVAL policy
 * - PENDING → APPROVED_WITH_WARNING — outside geofence with ALLOW_WITH_REASON and reason supplied
 *
 * ## Active attendance (clock-out)
 * - CLOCKED_IN → CLOCKED_OUT
 * - PENDING_SUPERVISOR_APPROVAL → CLOCKED_OUT — officer may complete shift while review is pending
 * - APPROVED_WITH_WARNING → CLOCKED_OUT
 * - SUPERVISOR_APPROVED → CLOCKED_OUT
 *
 * ## Supervisor review
 * - PENDING_SUPERVISOR_APPROVAL → SUPERVISOR_APPROVED
 * - PENDING_SUPERVISOR_APPROVAL → SUPERVISOR_REJECTED
 * - PENDING_SUPERVISOR_APPROVAL → CLOCKED_IN — supervisor normalizes to standard active status
 * - APPROVED_WITH_WARNING → SUPERVISOR_APPROVED
 * - APPROVED_WITH_WARNING → SUPERVISOR_REJECTED
 * - CLOCKED_OUT → SUPERVISOR_APPROVED — post-shift approval
 * - CLOCKED_OUT → SUPERVISOR_REJECTED — post-shift rejection
 *
 * ## Administrative void
 * - Any non-terminal status → VOIDED
 */
export const ATTENDANCE_TRANSITIONS: Readonly<
  Partial<
    Record<AttendanceStatus, Readonly<Partial<Record<AttendanceStatus, true>>>>
  >
> = {
  [AttendanceStatus.PENDING]: {
    [AttendanceStatus.CLOCKED_IN]: true,
    [AttendanceStatus.PENDING_SUPERVISOR_APPROVAL]: true,
    [AttendanceStatus.APPROVED_WITH_WARNING]: true,
    [AttendanceStatus.VOIDED]: true,
  },
  [AttendanceStatus.CLOCKED_IN]: {
    [AttendanceStatus.CLOCKED_OUT]: true,
    [AttendanceStatus.PENDING_SUPERVISOR_APPROVAL]: true,
    [AttendanceStatus.VOIDED]: true,
  },
  [AttendanceStatus.PENDING_SUPERVISOR_APPROVAL]: {
    [AttendanceStatus.CLOCKED_OUT]: true,
    [AttendanceStatus.SUPERVISOR_APPROVED]: true,
    [AttendanceStatus.SUPERVISOR_REJECTED]: true,
    [AttendanceStatus.CLOCKED_IN]: true,
    [AttendanceStatus.VOIDED]: true,
  },
  [AttendanceStatus.APPROVED_WITH_WARNING]: {
    [AttendanceStatus.CLOCKED_OUT]: true,
    [AttendanceStatus.PENDING_SUPERVISOR_APPROVAL]: true,
    [AttendanceStatus.SUPERVISOR_APPROVED]: true,
    [AttendanceStatus.SUPERVISOR_REJECTED]: true,
    [AttendanceStatus.VOIDED]: true,
  },
  [AttendanceStatus.SUPERVISOR_APPROVED]: {
    [AttendanceStatus.CLOCKED_OUT]: true,
    [AttendanceStatus.VOIDED]: true,
  },
  [AttendanceStatus.CLOCKED_OUT]: {
    [AttendanceStatus.PENDING_SUPERVISOR_APPROVAL]: true,
    [AttendanceStatus.SUPERVISOR_APPROVED]: true,
    [AttendanceStatus.SUPERVISOR_REJECTED]: true,
    [AttendanceStatus.VOIDED]: true,
  },
  [AttendanceStatus.SUPERVISOR_REJECTED]: {
    [AttendanceStatus.VOIDED]: true,
  },
} as const;

/** Statuses produced directly by a successful clock-in attempt. */
export const CLOCK_IN_RESULT_STATUSES: readonly AttendanceStatus[] = [
  AttendanceStatus.CLOCKED_IN,
  AttendanceStatus.PENDING_SUPERVISOR_APPROVAL,
  AttendanceStatus.APPROVED_WITH_WARNING,
] as const;

/** Statuses that indicate attendance is still active (not yet clocked out). */
export const ACTIVE_ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  AttendanceStatus.CLOCKED_IN,
  AttendanceStatus.PENDING_SUPERVISOR_APPROVAL,
  AttendanceStatus.APPROVED_WITH_WARNING,
  AttendanceStatus.SUPERVISOR_APPROVED,
] as const;

export function assertAttendanceTransition(
  from: AttendanceStatus,
  to: AttendanceStatus,
): void {
  if (!ATTENDANCE_TRANSITIONS[from]?.[to]) {
    throw new AppException(
      `Attendance status transition from ${from} to ${to} is not allowed`,
      HttpStatus.CONFLICT,
      ErrorCode.ATTENDANCE_STATUS_TRANSITION_INVALID,
    );
  }
}
