import { hashQrCode, normalizeQrCode, verifyQrCode } from './patrol-qr.util';

describe('patrol-qr.util', () => {
  it('normalizes and hashes consistently', () => {
    const a = hashQrCode('gt-mkn-hq-gate-001');
    const b = hashQrCode('  GT-MKN-HQ-GATE-001  ');
    expect(a).toBe(b);
    expect(normalizeQrCode(' abc ')).toBe('ABC');
  });

  it('verifies matching QR and rejects mismatches', () => {
    const hash = hashQrCode('GT-CP-2');
    expect(verifyQrCode('gt-cp-2', hash)).toBe(true);
    expect(verifyQrCode('WRONG', hash)).toBe(false);
    expect(verifyQrCode(null, hash)).toBe(false);
    expect(verifyQrCode('GT-CP-2', null)).toBe(false);
  });

  it('never exposes plaintext in hash output as original', () => {
    const raw = 'GT-SECRET-VALUE';
    const hash = hashQrCode(raw);
    expect(hash).not.toContain(raw);
    expect(hash).toHaveLength(64);
  });
});
