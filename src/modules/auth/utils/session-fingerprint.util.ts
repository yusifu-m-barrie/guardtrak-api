import { createHash } from 'crypto';

/**
 * Derives a stable session fingerprint from client signals (UA + platform).
 * Stored truncated to 32 hex chars on RefreshSession.fingerprint.
 */
export function buildSessionFingerprint(
  userAgent?: string | null,
  platform?: string | null,
): string {
  const raw = `${userAgent ?? ''}|${platform ?? ''}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

/** @deprecated Use buildSessionFingerprint */
export const computeSessionFingerprint = buildSessionFingerprint;
