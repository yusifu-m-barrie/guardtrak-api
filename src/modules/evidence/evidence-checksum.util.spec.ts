import { checksumsMatch, isValidSha256Hex } from './evidence-checksum.util';

describe('evidence checksum validation', () => {
  it('validates sha256 hex', () => {
    expect(isValidSha256Hex('a'.repeat(64))).toBe(true);
    expect(isValidSha256Hex('zz')).toBe(false);
    expect(isValidSha256Hex(null)).toBe(false);
  });

  it('compares checksums case-insensitively', () => {
    const hex = 'ab'.repeat(32);
    expect(checksumsMatch(hex.toUpperCase(), hex)).toBe(true);
    expect(checksumsMatch(hex, '0'.repeat(64))).toBe(false);
    expect(checksumsMatch(null, hex)).toBe(true);
  });
});
