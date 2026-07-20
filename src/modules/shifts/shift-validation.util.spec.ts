import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { assertShiftScheduleValid } from './shift-validation.util';

describe('assertShiftScheduleValid', () => {
  const base = {
    scheduledStartAt: new Date('2026-07-20T18:00:00.000Z'),
    scheduledEndAt: new Date('2026-07-21T06:00:00.000Z'),
    unpaidBreakMinutes: 60,
    maxDurationHours: 24,
  };

  it('accepts a valid overnight shift', () => {
    expect(() => assertShiftScheduleValid(base)).not.toThrow();
  });

  it('rejects end before start', () => {
    expect(() =>
      assertShiftScheduleValid({
        ...base,
        scheduledEndAt: new Date('2026-07-20T17:00:00.000Z'),
      }),
    ).toThrow(AppException);

    try {
      assertShiftScheduleValid({
        ...base,
        scheduledEndAt: new Date('2026-07-20T17:00:00.000Z'),
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      const appError = error as AppException;
      expect(appError.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      const body = appError.getResponse() as { code: string };
      expect(body.code).toBe(ErrorCode.SHIFT_TIME_RANGE_INVALID);
    }
  });

  it('rejects excessive duration', () => {
    expect(() =>
      assertShiftScheduleValid({
        ...base,
        scheduledEndAt: new Date('2026-07-22T18:00:00.000Z'),
        maxDurationHours: 24,
      }),
    ).toThrow(AppException);
  });

  it('rejects unpaid break longer than shift', () => {
    expect(() =>
      assertShiftScheduleValid({
        ...base,
        unpaidBreakMinutes: 13 * 60,
      }),
    ).toThrow(AppException);
  });
});
