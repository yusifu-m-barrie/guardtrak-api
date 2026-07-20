import { randomUUID } from 'crypto';

export function generateRequestId(): string {
  return randomUUID();
}

export function isValidRequestId(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  // Allow UUIDs and simple opaque tokens up to 128 chars
  return value.length > 0 && value.length <= 128 && /^[\w\-.:]+$/.test(value);
}
