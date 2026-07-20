import { HttpStatus } from '@nestjs/common';
import { BreakStatus } from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';

export const BREAK_TRANSITIONS: Readonly<
  Partial<Record<BreakStatus, Readonly<Partial<Record<BreakStatus, true>>>>>
> = {
  [BreakStatus.ACTIVE]: {
    [BreakStatus.COMPLETED]: true,
    [BreakStatus.CANCELLED]: true,
  },
} as const;

export function assertBreakTransition(
  from: BreakStatus,
  to: BreakStatus,
): void {
  if (!BREAK_TRANSITIONS[from]?.[to]) {
    throw new AppException(
      `Break status transition from ${from} to ${to} is not allowed`,
      HttpStatus.CONFLICT,
      ErrorCode.BREAK_STATUS_TRANSITION_INVALID,
    );
  }
}
