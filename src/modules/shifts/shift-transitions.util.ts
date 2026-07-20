import { HttpStatus } from '@nestjs/common';
import { ShiftStatus } from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';

export interface ShiftTransitionRule {
  readonly requiresReason: boolean;
}

export const SHIFT_TRANSITIONS: Readonly<
  Partial<
    Record<
      ShiftStatus,
      Readonly<Partial<Record<ShiftStatus, ShiftTransitionRule>>>
    >
  >
> = {
  [ShiftStatus.DRAFT]: {
    [ShiftStatus.SCHEDULED]: { requiresReason: false },
    [ShiftStatus.CANCELLED]: { requiresReason: false },
  },
  [ShiftStatus.SCHEDULED]: {
    [ShiftStatus.IN_PROGRESS]: { requiresReason: false },
    [ShiftStatus.CANCELLED]: { requiresReason: false },
  },
  [ShiftStatus.IN_PROGRESS]: {
    [ShiftStatus.COMPLETED]: { requiresReason: false },
    [ShiftStatus.CANCELLED]: { requiresReason: true },
  },
  [ShiftStatus.COMPLETED]: {
    [ShiftStatus.ARCHIVED]: { requiresReason: false },
  },
  [ShiftStatus.CANCELLED]: {
    [ShiftStatus.ARCHIVED]: { requiresReason: false },
  },
} as const;

export function shiftTransitionRequiresReason(
  from: ShiftStatus,
  to: ShiftStatus,
): boolean {
  return SHIFT_TRANSITIONS[from]?.[to]?.requiresReason ?? false;
}

export function assertShiftTransition(
  from: ShiftStatus,
  to: ShiftStatus,
): void {
  if (!SHIFT_TRANSITIONS[from]?.[to]) {
    throw new AppException(
      `Shift status transition from ${from} to ${to} is not allowed`,
      HttpStatus.CONFLICT,
      ErrorCode.SHIFT_STATUS_TRANSITION_INVALID,
    );
  }
}
