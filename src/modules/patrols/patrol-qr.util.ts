import { createHash, timingSafeEqual } from 'crypto';

export function normalizeQrCode(value: string): string {
  return value.trim().toUpperCase();
}

export function hashQrCode(value: string): string {
  return createHash('sha256')
    .update(normalizeQrCode(value), 'utf8')
    .digest('hex');
}

/**
 * Constant-time comparison of submitted QR against stored hash.
 * Returns false when hash is missing or lengths differ.
 */
export function verifyQrCode(
  submittedRaw: string | null | undefined,
  storedHash: string | null | undefined,
): boolean {
  if (!submittedRaw || !storedHash) {
    return false;
  }
  const submittedHash = hashQrCode(submittedRaw);
  const a = Buffer.from(submittedHash, 'utf8');
  const b = Buffer.from(storedHash, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
