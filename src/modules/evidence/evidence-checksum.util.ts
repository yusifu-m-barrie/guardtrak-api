export function isValidSha256Hex(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  return /^[a-fA-F0-9]{64}$/.test(value);
}

export function checksumsMatch(
  expected: string | null | undefined,
  actual: string | null | undefined,
): boolean {
  if (!expected || !actual) {
    return true;
  }
  return expected.toLowerCase() === actual.toLowerCase();
}
