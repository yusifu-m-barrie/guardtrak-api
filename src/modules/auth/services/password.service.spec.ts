import { PasswordService } from './password.service';
import { buildSessionFingerprint } from '../utils/session-fingerprint.util';

describe('PasswordService', () => {
  const service = new PasswordService();

  it(
    'hashes and verifies passwords with argon2',
    async () => {
      const hash = await service.hash('FOLPS!Dev2026');
      expect(hash.startsWith('$argon2')).toBe(true);
      expect(await service.verify(hash, 'FOLPS!Dev2026')).toBe(true);
      expect(await service.verify(hash, 'wrong-password')).toBe(false);
    },
    30_000,
  );

  it('enforces password policy', () => {
    expect(service.validatePolicy('short').valid).toBe(false);
    expect(service.validatePolicy('NoNumber!').valid).toBe(false);
    expect(service.validatePolicy('ValidPass1!').valid).toBe(true);
  });

  it('scores password strength from weak to excellent', () => {
    expect(service.scoreStrength('abc').label).toBe('weak');
    expect(service.scoreStrength('abcdefghij').score).toBeGreaterThanOrEqual(1);
    expect(service.scoreStrength('ValidPass1!').label).toBe('strong');
    expect(service.scoreStrength('VeryLongValidPass1!@#').label).toBe(
      'excellent',
    );
  });
});

describe('buildSessionFingerprint', () => {
  it('derives a stable 32-char hex fingerprint', () => {
    const a = buildSessionFingerprint('Mozilla/5.0', 'ANDROID');
    const b = buildSessionFingerprint('Mozilla/5.0', 'ANDROID');
    const c = buildSessionFingerprint('Mozilla/5.0', 'IOS');
    expect(a).toHaveLength(32);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
