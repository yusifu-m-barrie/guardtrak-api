import { HttpStatus } from '@nestjs/common';
import { ShiftStatus } from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import {
  assertShiftTransition,
  shiftTransitionRequiresReason,
} from './shift-transitions.util';

describe('shift-transitions.util', () => {
  describe('assertShiftTransition', () => {
    it('allows DRAFT to SCHEDULED', () => {
      expect(() =>
        assertShiftTransition(ShiftStatus.DRAFT, ShiftStatus.SCHEDULED),
      ).not.toThrow();
    });

    it('allows DRAFT to CANCELLED', () => {
      expect(() =>
        assertShiftTransition(ShiftStatus.DRAFT, ShiftStatus.CANCELLED),
      ).not.toThrow();
    });

    it('allows SCHEDULED to IN_PROGRESS and CANCELLED', () => {
      expect(() =>
        assertShiftTransition(ShiftStatus.SCHEDULED, ShiftStatus.IN_PROGRESS),
      ).not.toThrow();
      expect(() =>
        assertShiftTransition(ShiftStatus.SCHEDULED, ShiftStatus.CANCELLED),
      ).not.toThrow();
    });

    it('allows IN_PROGRESS to COMPLETED and CANCELLED', () => {
      expect(() =>
        assertShiftTransition(ShiftStatus.IN_PROGRESS, ShiftStatus.COMPLETED),
      ).not.toThrow();
      expect(() =>
        assertShiftTransition(ShiftStatus.IN_PROGRESS, ShiftStatus.CANCELLED),
      ).not.toThrow();
    });

    it('allows COMPLETED and CANCELLED to ARCHIVED', () => {
      expect(() =>
        assertShiftTransition(ShiftStatus.COMPLETED, ShiftStatus.ARCHIVED),
      ).not.toThrow();
      expect(() =>
        assertShiftTransition(ShiftStatus.CANCELLED, ShiftStatus.ARCHIVED),
      ).not.toThrow();
    });

    it('rejects invalid transitions with 409 SHIFT_STATUS_TRANSITION_INVALID', () => {
      expect(() =>
        assertShiftTransition(ShiftStatus.ARCHIVED, ShiftStatus.DRAFT),
      ).toThrow(AppException);

      try {
        assertShiftTransition(ShiftStatus.DRAFT, ShiftStatus.IN_PROGRESS);
      } catch (error) {
        expect((error as AppException).getResponse()).toMatchObject({
          code: ErrorCode.SHIFT_STATUS_TRANSITION_INVALID,
        });
        expect((error as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
      }
    });
  });

  describe('shiftTransitionRequiresReason', () => {
    it('requires reason for IN_PROGRESS to CANCELLED only', () => {
      expect(
        shiftTransitionRequiresReason(
          ShiftStatus.IN_PROGRESS,
          ShiftStatus.CANCELLED,
        ),
      ).toBe(true);
      expect(
        shiftTransitionRequiresReason(
          ShiftStatus.SCHEDULED,
          ShiftStatus.CANCELLED,
        ),
      ).toBe(false);
      expect(
        shiftTransitionRequiresReason(ShiftStatus.DRAFT, ShiftStatus.CANCELLED),
      ).toBe(false);
    });

    it('returns false for unknown transitions', () => {
      expect(
        shiftTransitionRequiresReason(ShiftStatus.ARCHIVED, ShiftStatus.DRAFT),
      ).toBe(false);
    });
  });
});
