import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';

export function assertShiftScheduleValid(input: {
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  unpaidBreakMinutes: number;
  maxDurationHours: number;
}): void {
  if (!(input.scheduledEndAt > input.scheduledStartAt)) {
    throw new AppException(
      'scheduledEndAt must be after scheduledStartAt',
      HttpStatus.BAD_REQUEST,
      ErrorCode.SHIFT_TIME_RANGE_INVALID,
    );
  }

  const durationMs =
    input.scheduledEndAt.getTime() - input.scheduledStartAt.getTime();
  const maxMs = input.maxDurationHours * 60 * 60 * 1000;
  if (durationMs > maxMs) {
    throw new AppException(
      `Shift duration exceeds maximum of ${input.maxDurationHours} hours`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.SHIFT_DURATION_INVALID,
    );
  }

  const durationMinutes = Math.floor(durationMs / 60_000);
  if (input.unpaidBreakMinutes > durationMinutes) {
    throw new AppException(
      'unpaidBreakMinutes cannot exceed total shift duration',
      HttpStatus.BAD_REQUEST,
      ErrorCode.SHIFT_DURATION_INVALID,
    );
  }
}
