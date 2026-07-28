/**
 * Safely parse a comma-separated CORS origins string.
 * Empty segments are discarded; whitespace is trimmed.
 */
export function parseCorsOrigins(raw: string | undefined | null): string[] {
  if (!raw || raw.trim().length === 0) {
    return [];
  }

  return raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);
}
