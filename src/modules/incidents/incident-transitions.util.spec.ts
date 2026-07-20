import { IncidentStatus } from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import {
  assertIncidentTransition,
  canReopenIncident,
} from './incident-transitions.util';

describe('incident transitions', () => {
  it('allows DRAFT → SUBMITTED and NEW', () => {
    expect(() =>
      assertIncidentTransition(IncidentStatus.DRAFT, IncidentStatus.SUBMITTED),
    ).not.toThrow();
    expect(() =>
      assertIncidentTransition(IncidentStatus.DRAFT, IncidentStatus.NEW),
    ).not.toThrow();
  });

  it('allows CLOSED → UNDER_REVIEW reopen', () => {
    expect(() =>
      assertIncidentTransition(
        IncidentStatus.CLOSED,
        IncidentStatus.UNDER_REVIEW,
      ),
    ).not.toThrow();
    expect(canReopenIncident(IncidentStatus.CLOSED)).toBe(true);
  });

  it('rejects CLOSED → NEW', () => {
    expect(() =>
      assertIncidentTransition(IncidentStatus.CLOSED, IncidentStatus.NEW),
    ).toThrow(AppException);
    try {
      assertIncidentTransition(IncidentStatus.CLOSED, IncidentStatus.NEW);
    } catch (error) {
      const response = (error as AppException).getResponse() as {
        code: string;
      };
      expect(response.code).toBe(ErrorCode.INCIDENT_STATUS_TRANSITION_INVALID);
    }
  });
});
