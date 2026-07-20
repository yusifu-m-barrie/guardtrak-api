import { EmergencyStatus } from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import {
  assertEmergencyTransition,
  toApiEmergencyStatus,
  toDbEmergencyStatus,
} from './emergency-transitions.util';

describe('emergency transitions', () => {
  it('maps ACTIVE ↔ CREATED', () => {
    expect(toDbEmergencyStatus('ACTIVE')).toBe(EmergencyStatus.CREATED);
    expect(toApiEmergencyStatus(EmergencyStatus.CREATED)).toBe('ACTIVE');
  });

  it('allows CREATED → ACKNOWLEDGED and FALSE_ALARM', () => {
    expect(() =>
      assertEmergencyTransition(
        EmergencyStatus.CREATED,
        EmergencyStatus.ACKNOWLEDGED,
      ),
    ).not.toThrow();
    expect(() =>
      assertEmergencyTransition(
        EmergencyStatus.CREATED,
        EmergencyStatus.FALSE_ALARM,
      ),
    ).not.toThrow();
  });

  it('rejects RESOLVED → ACKNOWLEDGED', () => {
    expect(() =>
      assertEmergencyTransition(
        EmergencyStatus.RESOLVED,
        EmergencyStatus.ACKNOWLEDGED,
      ),
    ).toThrow(AppException);
  });
});
