import { HttpStatus } from '@nestjs/common';
import { IncidentStatus } from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';

export const INCIDENT_TRANSITIONS: Readonly<
  Partial<
    Record<IncidentStatus, Readonly<Partial<Record<IncidentStatus, true>>>>
  >
> = {
  [IncidentStatus.DRAFT]: {
    [IncidentStatus.SUBMITTED]: true,
    [IncidentStatus.NEW]: true,
  },
  [IncidentStatus.SUBMITTED]: {
    [IncidentStatus.NEW]: true,
    [IncidentStatus.ACKNOWLEDGED]: true,
    [IncidentStatus.UNDER_REVIEW]: true,
    [IncidentStatus.REJECTED]: true,
  },
  [IncidentStatus.NEW]: {
    [IncidentStatus.ACKNOWLEDGED]: true,
    [IncidentStatus.UNDER_REVIEW]: true,
    [IncidentStatus.REJECTED]: true,
  },
  [IncidentStatus.ACKNOWLEDGED]: {
    [IncidentStatus.OFFICER_DISPATCHED]: true,
    [IncidentStatus.UNDER_REVIEW]: true,
    [IncidentStatus.UNDER_INVESTIGATION]: true,
    [IncidentStatus.ESCALATED]: true,
    [IncidentStatus.RESOLVED]: true,
  },
  [IncidentStatus.OFFICER_DISPATCHED]: {
    [IncidentStatus.UNDER_REVIEW]: true,
    [IncidentStatus.UNDER_INVESTIGATION]: true,
    [IncidentStatus.ESCALATED]: true,
    [IncidentStatus.RESOLVED]: true,
  },
  [IncidentStatus.UNDER_REVIEW]: {
    [IncidentStatus.UNDER_INVESTIGATION]: true,
    [IncidentStatus.ESCALATED]: true,
    [IncidentStatus.RESOLVED]: true,
    [IncidentStatus.CLOSED]: true,
    [IncidentStatus.REJECTED]: true,
  },
  [IncidentStatus.UNDER_INVESTIGATION]: {
    [IncidentStatus.ESCALATED]: true,
    [IncidentStatus.RESOLVED]: true,
    [IncidentStatus.CLOSED]: true,
  },
  [IncidentStatus.ESCALATED]: {
    [IncidentStatus.UNDER_INVESTIGATION]: true,
    [IncidentStatus.RESOLVED]: true,
    [IncidentStatus.CLOSED]: true,
  },
  [IncidentStatus.RESOLVED]: {
    [IncidentStatus.CLOSED]: true,
    [IncidentStatus.UNDER_REVIEW]: true,
  },
  [IncidentStatus.CLOSED]: {
    [IncidentStatus.UNDER_REVIEW]: true,
  },
  [IncidentStatus.REJECTED]: {
    [IncidentStatus.UNDER_REVIEW]: true,
  },
} as const;

export function assertIncidentTransition(
  from: IncidentStatus,
  to: IncidentStatus,
): void {
  if (from === to) {
    return;
  }
  if (!INCIDENT_TRANSITIONS[from]?.[to]) {
    throw new AppException(
      `Incident status transition from ${from} to ${to} is not allowed`,
      HttpStatus.CONFLICT,
      ErrorCode.INCIDENT_STATUS_TRANSITION_INVALID,
    );
  }
}

export function canReopenIncident(status: IncidentStatus): boolean {
  return status === IncidentStatus.CLOSED || status === IncidentStatus.REJECTED;
}
