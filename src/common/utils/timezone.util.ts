export const DEFAULT_TIMEZONE = 'UTC';

export type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function isValidTimeZone(timeZone: string | null | undefined): boolean {
  if (!timeZone?.trim()) {
    return false;
  }
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timeZone.trim() }).format(
      new Date(),
    );
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(
  preferred?: string | null,
  fallback?: string | null,
): string {
  if (preferred && isValidTimeZone(preferred)) {
    return preferred.trim();
  }
  if (fallback && isValidTimeZone(fallback)) {
    return fallback.trim();
  }
  return DEFAULT_TIMEZONE;
}

export function zonedParts(date: Date, timeZone: string): ZonedDateParts {
  const tz = resolveTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  });
  const mapped: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      mapped[part.type] = part.value;
    }
  }
  return {
    year: Number(mapped.year),
    month: Number(mapped.month),
    day: Number(mapped.day),
    hour: Number(mapped.hour),
    minute: Number(mapped.minute),
    second: Number(mapped.second),
    weekday: WEEKDAY_INDEX[mapped.weekday] ?? 0,
  };
}

export function zonedDateKey(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function parseDateKey(value: string): {
  year: number;
  month: number;
  day: number;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/**
 * Convert a wall-clock date/time in `timeZone` to an absolute UTC Date.
 */
export function zonedDateTime(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const tz = resolveTimeZone(timeZone);
  const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = wanted;
  for (let i = 0; i < 4; i += 1) {
    const actual = zonedParts(new Date(utc), tz);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const delta = wanted - actualAsUtc;
    if (delta === 0) {
      break;
    }
    utc += delta;
  }
  return new Date(utc);
}

export function startOfZonedDay(dateKey: string, timeZone: string): Date {
  const parsed = parseDateKey(dateKey);
  if (!parsed) {
    return new Date(dateKey);
  }
  return zonedDateTime(
    timeZone,
    parsed.year,
    parsed.month,
    parsed.day,
    0,
    0,
    0,
  );
}

export function endOfZonedDay(dateKey: string, timeZone: string): Date {
  const parsed = parseDateKey(dateKey);
  if (!parsed) {
    return new Date(dateKey);
  }
  const end = zonedDateTime(
    timeZone,
    parsed.year,
    parsed.month,
    parsed.day,
    23,
    59,
    59,
  );
  return new Date(end.getTime() + 999);
}

export function addCalendarDays(dateKey: string, days: number): string {
  const parsed = parseDateKey(dateKey);
  if (!parsed) {
    return dateKey;
  }
  const utc = Date.UTC(parsed.year, parsed.month - 1, parsed.day + days);
  const next = new Date(utc);
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

export function dateKeyToUtcDate(dateKey: string): Date {
  const parsed = parseDateKey(dateKey);
  if (!parsed) {
    return new Date(dateKey);
  }
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
}
