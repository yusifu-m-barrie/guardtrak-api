import { HttpStatus } from '@nestjs/common';
import {
  PatrolAssignmentStatus,
  PatrolRouteStatus,
} from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';

export const PATROL_ROUTE_TRANSITIONS: Readonly<
  Partial<
    Record<
      PatrolRouteStatus,
      Readonly<Partial<Record<PatrolRouteStatus, true>>>
    >
  >
> = {
  [PatrolRouteStatus.DRAFT]: {
    [PatrolRouteStatus.ACTIVE]: true,
    [PatrolRouteStatus.INACTIVE]: true,
    [PatrolRouteStatus.ARCHIVED]: true,
  },
  [PatrolRouteStatus.ACTIVE]: {
    [PatrolRouteStatus.INACTIVE]: true,
    [PatrolRouteStatus.ARCHIVED]: true,
  },
  [PatrolRouteStatus.INACTIVE]: {
    [PatrolRouteStatus.ACTIVE]: true,
    [PatrolRouteStatus.ARCHIVED]: true,
  },
} as const;

export const PATROL_ASSIGNMENT_TRANSITIONS: Readonly<
  Partial<
    Record<
      PatrolAssignmentStatus,
      Readonly<Partial<Record<PatrolAssignmentStatus, true>>>
    >
  >
> = {
  [PatrolAssignmentStatus.NOT_STARTED]: {
    [PatrolAssignmentStatus.IN_PROGRESS]: true,
    [PatrolAssignmentStatus.CANCELLED]: true,
    [PatrolAssignmentStatus.MISSED]: true,
  },
  [PatrolAssignmentStatus.IN_PROGRESS]: {
    [PatrolAssignmentStatus.COMPLETED]: true,
    [PatrolAssignmentStatus.PARTIALLY_COMPLETED]: true,
    [PatrolAssignmentStatus.CANCELLED]: true,
    [PatrolAssignmentStatus.MISSED]: true,
    [PatrolAssignmentStatus.REQUIRES_REVIEW]: true,
  },
  [PatrolAssignmentStatus.REQUIRES_REVIEW]: {
    [PatrolAssignmentStatus.COMPLETED]: true,
    [PatrolAssignmentStatus.PARTIALLY_COMPLETED]: true,
    [PatrolAssignmentStatus.CANCELLED]: true,
  },
} as const;

export const ACTIVE_PATROL_ASSIGNMENT_STATUSES: readonly PatrolAssignmentStatus[] =
  [
    PatrolAssignmentStatus.NOT_STARTED,
    PatrolAssignmentStatus.IN_PROGRESS,
    PatrolAssignmentStatus.REQUIRES_REVIEW,
  ] as const;

export function assertPatrolRouteTransition(
  from: PatrolRouteStatus,
  to: PatrolRouteStatus,
): void {
  if (!PATROL_ROUTE_TRANSITIONS[from]?.[to]) {
    throw new AppException(
      `Patrol route status transition from ${from} to ${to} is not allowed`,
      HttpStatus.CONFLICT,
      ErrorCode.PATROL_ROUTE_STATUS_INVALID,
    );
  }
}

export function assertPatrolAssignmentTransition(
  from: PatrolAssignmentStatus,
  to: PatrolAssignmentStatus,
): void {
  if (!PATROL_ASSIGNMENT_TRANSITIONS[from]?.[to]) {
    throw new AppException(
      `Patrol assignment status transition from ${from} to ${to} is not allowed`,
      HttpStatus.CONFLICT,
      ErrorCode.PATROL_ASSIGNMENT_STATUS_INVALID,
    );
  }
}
