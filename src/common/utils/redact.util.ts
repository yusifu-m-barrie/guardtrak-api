const SENSITIVE_KEY_PATTERN =
  /(authorization|password|passwd|token|secret|refresh.?token|access.?token|api.?key|cookie)/i;

const REDACTED = '[REDACTED]';

export function redactSensitiveValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return REDACTED;
  }
  return value;
}

export function redactHeaders(
  headers: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = redactSensitiveValue(key, value);
  }
  return result;
}

export function redactObject(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactObject(value as Record<string, unknown>);
      continue;
    }
    result[key] = redactSensitiveValue(key, value);
  }
  return result;
}
