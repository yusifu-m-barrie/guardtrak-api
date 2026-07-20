export function trimOrUndefined(
  value: string | null | undefined,
): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function normalizeEmployeeId(employeeId: string): string {
  return employeeId.trim().toUpperCase();
}

export function normalizePhone(
  phone: string | null | undefined,
): string | null {
  if (!phone) {
    return null;
  }
  const trimmed = phone.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizePersonName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}
