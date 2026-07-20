import { HttpStatus } from '@nestjs/common';
import {
  PatrolAssignmentStatus,
  PatrolRouteStatus,
} from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import {
  ACTIVE_PATROL_ASSIGNMENT_STATUSES,
  assertPatrolAssignmentTransition,
  assertPatrolRouteTransition,
} from './patrol-transitions.util';

describe('patrol-transitions.util', () => {
  describe('assertPatrolRouteTransition', () => {
    it('allows DRAFT to ACTIVE and ARCHIVED', () => {
      expect(() =>
        assertPatrolRouteTransition(
          PatrolRouteStatus.DRAFT,
          PatrolRouteStatus.ACTIVE,
        ),
      ).not.toThrow();
      expect(() =>
        assertPatrolRouteTransition(
          PatrolRouteStatus.DRAFT,
          PatrolRouteStatus.ARCHIVED,
        ),
      ).not.toThrow();
    });

    it('allows ACTIVE to INACTIVE and ARCHIVED', () => {
      expect(() =>
        assertPatrolRouteTransition(
          PatrolRouteStatus.ACTIVE,
          PatrolRouteStatus.INACTIVE,
        ),
      ).not.toThrow();
      expect(() =>
        assertPatrolRouteTransition(
          PatrolRouteStatus.ACTIVE,
          PatrolRouteStatus.ARCHIVED,
        ),
      ).not.toThrow();
    });

    it('rejects invalid route transitions with PATROL_ROUTE_STATUS_INVALID', () => {
      expect(() =>
        assertPatrolRouteTransition(
          PatrolRouteStatus.ACTIVE,
          PatrolRouteStatus.DRAFT,
        ),
      ).toThrow(AppException);

      try {
        assertPatrolRouteTransition(
          PatrolRouteStatus.ARCHIVED,
          PatrolRouteStatus.ACTIVE,
        );
      } catch (error) {
        expect((error as AppException).getResponse()).toMatchObject({
          code: ErrorCode.PATROL_ROUTE_STATUS_INVALID,
        });
        expect((error as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
      }
    });
  });

  describe('assertPatrolAssignmentTransition', () => {
    it('allows NOT_STARTED to IN_PROGRESS / CANCELLED / MISSED', () => {
      expect(() =>
        assertPatrolAssignmentTransition(
          PatrolAssignmentStatus.NOT_STARTED,
          PatrolAssignmentStatus.IN_PROGRESS,
        ),
      ).not.toThrow();
      expect(() =>
        assertPatrolAssignmentTransition(
          PatrolAssignmentStatus.NOT_STARTED,
          PatrolAssignmentStatus.CANCELLED,
        ),
      ).not.toThrow();
      expect(() =>
        assertPatrolAssignmentTransition(
          PatrolAssignmentStatus.NOT_STARTED,
          PatrolAssignmentStatus.MISSED,
        ),
      ).not.toThrow();
    });

    it('allows IN_PROGRESS to COMPLETED and PARTIALLY_COMPLETED', () => {
      expect(() =>
        assertPatrolAssignmentTransition(
          PatrolAssignmentStatus.IN_PROGRESS,
          PatrolAssignmentStatus.COMPLETED,
        ),
      ).not.toThrow();
      expect(() =>
        assertPatrolAssignmentTransition(
          PatrolAssignmentStatus.IN_PROGRESS,
          PatrolAssignmentStatus.PARTIALLY_COMPLETED,
        ),
      ).not.toThrow();
    });

    it('rejects invalid assignment transitions with PATROL_ASSIGNMENT_STATUS_INVALID', () => {
      try {
        assertPatrolAssignmentTransition(
          PatrolAssignmentStatus.COMPLETED,
          PatrolAssignmentStatus.IN_PROGRESS,
        );
      } catch (error) {
        expect((error as AppException).getResponse()).toMatchObject({
          code: ErrorCode.PATROL_ASSIGNMENT_STATUS_INVALID,
        });
        expect((error as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
      }
    });
  });

  describe('ACTIVE_PATROL_ASSIGNMENT_STATUSES', () => {
    it('includes not-started, in-progress, and requires-review', () => {
      expect(ACTIVE_PATROL_ASSIGNMENT_STATUSES).toEqual([
        PatrolAssignmentStatus.NOT_STARTED,
        PatrolAssignmentStatus.IN_PROGRESS,
        PatrolAssignmentStatus.REQUIRES_REVIEW,
      ]);
    });
  });
});
