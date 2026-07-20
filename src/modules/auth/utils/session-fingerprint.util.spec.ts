import { buildSessionFingerprint } from './session-fingerprint.util';

describe('buildSessionFingerprint', () => {
  it('returns a stable 32-char hex for the same inputs', () => {
    const a = buildSessionFingerprint('Mozilla/5.0', 'WEB');
    const b = buildSessionFingerprint('Mozilla/5.0', 'WEB');
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });

  it('changes when user-agent or platform changes', () => {
    const base = buildSessionFingerprint('Mozilla/5.0', 'WEB');
    expect(buildSessionFingerprint('OtherAgent', 'WEB')).not.toBe(base);
    expect(buildSessionFingerprint('Mozilla/5.0', 'ANDROID')).not.toBe(base);
  });
});
