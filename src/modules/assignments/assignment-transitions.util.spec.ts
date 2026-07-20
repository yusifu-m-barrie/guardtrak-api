import { HttpStatus } from '@nestjs/common';
import { AssignmentStatus } from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  assertAssignmentTransition,
} from './assignment-transitions.util';

describe('assignment-transitions.util', () => {
  describe('assertAssignmentTransition', () => {
    it('allows ASSIGNED transitions', () => {
      expect(() =>
        assertAssignmentTransition(
          AssignmentStatus.ASSIGNED,
          AssignmentStatus.CONFIRMED,
        ),
      ).not.toThrow();
      expect(() =>
        assertAssignmentTransition(
          AssignmentStatus.ASSIGNED,
          AssignmentStatus.CANCELLED,
        ),
      ).not.toThrow();
      expect(() =>
        assertAssignmentTransition(
          AssignmentStatus.ASSIGNED,
          AssignmentStatus.REASSIGNED,
        ),
      ).not.toThrow();
      expect(() =>
        assertAssignmentTransition(
          AssignmentStatus.ASSIGNED,
          AssignmentStatus.MISSED,
        ),
      ).not.toThrow();
    });

    it('allows CONFIRMED transitions', () => {
      expect(() =>
        assertAssignmentTransition(
          AssignmentStatus.CONFIRMED,
          AssignmentStatus.IN_PROGRESS,
        ),
      ).not.toThrow();
      expect(() =>
        assertAssignmentTransition(
          AssignmentStatus.CONFIRMED,
          AssignmentStatus.CANCELLED,
        ),
      ).not.toThrow();
      expect(() =>
        assertAssignmentTransition(
          AssignmentStatus.CONFIRMED,
          AssignmentStatus.REASSIGNED,
        ),
      ).not.toThrow();
      expect(() =>
        assertAssignmentTransition(
          AssignmentStatus.CONFIRMED,
          AssignmentStatus.MISSED,
        ),
      ).not.toThrow();
    });

    it('allows IN_PROGRESS to COMPLETED', () => {
      expect(() =>
        assertAssignmentTransition(
          AssignmentStatus.IN_PROGRESS,
          AssignmentStatus.COMPLETED,
        ),
      ).not.toThrow();
    });

    it('rejects invalid transitions with ASSIGNMENT_STATUS_TRANSITION_INVALID', () => {
      expect(() =>
        assertAssignmentTransition(
          AssignmentStatus.COMPLETED,
          AssignmentStatus.ASSIGNED,
        ),
      ).toThrow(AppException);

      try {
        assertAssignmentTransition(
          AssignmentStatus.MISSED,
          AssignmentStatus.CONFIRMED,
        );
      } catch (error) {
        expect((error as AppException).getResponse()).toMatchObject({
          code: ErrorCode.ASSIGNMENT_STATUS_TRANSITION_INVALID,
        });
        expect((error as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
      }
    });
  });

  describe('ACTIVE_ASSIGNMENT_STATUSES', () => {
    it('includes blocking statuses and excludes COMPLETED, CANCELLED, REASSIGNED, MISSED', () => {
      expect(ACTIVE_ASSIGNMENT_STATUSES).toEqual([
        AssignmentStatus.ASSIGNED,
        AssignmentStatus.CONFIRMED,
        AssignmentStatus.IN_PROGRESS,
      ]);
      expect(ACTIVE_ASSIGNMENT_STATUSES).not.toContain(
        AssignmentStatus.COMPLETED,
      );
      expect(ACTIVE_ASSIGNMENT_STATUSES).not.toContain(
        AssignmentStatus.CANCELLED,
      );
      expect(ACTIVE_ASSIGNMENT_STATUSES).not.toContain(
        AssignmentStatus.REASSIGNED,
      );
      expect(ACTIVE_ASSIGNMENT_STATUSES).not.toContain(AssignmentStatus.MISSED);
    });
  });
});
