import { RecurrenceType } from '../../../generated/prisma/client';
import {
  addCalendarDays,
  parseDateKey,
  resolveTimeZone,
  zonedDateKey,
  zonedDateTime,
  zonedParts,
} from '../../common/utils/timezone.util';
import { rangesOverlap } from '../assignments/assignment-overlap.util';

export type ShiftRecurrenceInput = {
  recurrenceType: RecurrenceType | null | undefined;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  recurrenceEndAt?: Date | null;
  recurrenceDaysOfWeek?: number[] | null;
  timezone?: string | null;
  organisationTimezone?: string | null;
};

export type ShiftOccurrence = {
  dateKey: string;
  startAt: Date;
  endAt: Date;
};

export function isRecurringShift(
  recurrenceType: RecurrenceType | null | undefined,
): boolean {
  return (
    recurrenceType === RecurrenceType.DAILY ||
    recurrenceType === RecurrenceType.WEEKLY ||
    recurrenceType === RecurrenceType.CUSTOM_WEEKDAYS
  );
}

export function normaliseDaysOfWeek(days?: number[] | null): number[] {
  if (!days?.length) {
    return [];
  }
  return [
    ...new Set(
      days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  ].sort((a, b) => a - b);
}

export function resolveShiftTimeZone(input: ShiftRecurrenceInput): string {
  return resolveTimeZone(input.timezone, input.organisationTimezone);
}

function matchingWeekdays(input: ShiftRecurrenceInput): number[] | null {
  const type = input.recurrenceType;
  if (!isRecurringShift(type)) {
    return null;
  }
  const explicit = normaliseDaysOfWeek(input.recurrenceDaysOfWeek);
  if (type === RecurrenceType.DAILY) {
    return [0, 1, 2, 3, 4, 5, 6];
  }
  if (explicit.length > 0) {
    return explicit;
  }
  if (type === RecurrenceType.WEEKLY) {
    return [
      zonedParts(input.scheduledStartAt, resolveShiftTimeZone(input)).weekday,
    ];
  }
  return [];
}

export function occurrenceOnDate(
  input: ShiftRecurrenceInput,
  dateKey: string,
): ShiftOccurrence | null {
  const timeZone = resolveShiftTimeZone(input);
  const parsed = parseDateKey(dateKey);
  if (!parsed) {
    return null;
  }

  const startKey = zonedDateKey(input.scheduledStartAt, timeZone);
  if (dateKey < startKey) {
    return null;
  }
  if (input.recurrenceEndAt) {
    const endKey = zonedDateKey(input.recurrenceEndAt, timeZone);
    if (dateKey > endKey) {
      return null;
    }
  }

  if (!isRecurringShift(input.recurrenceType)) {
    return dateKey === startKey
      ? {
          dateKey,
          startAt: input.scheduledStartAt,
          endAt: input.scheduledEndAt,
        }
      : null;
  }

  const weekdays = matchingWeekdays(input);
  if (!weekdays || weekdays.length === 0) {
    return null;
  }

  const probe = zonedDateTime(
    timeZone,
    parsed.year,
    parsed.month,
    parsed.day,
    12,
    0,
    0,
  );
  const weekday = zonedParts(probe, timeZone).weekday;
  if (!weekdays.includes(weekday)) {
    return null;
  }

  const startParts = zonedParts(input.scheduledStartAt, timeZone);
  const startAt = zonedDateTime(
    timeZone,
    parsed.year,
    parsed.month,
    parsed.day,
    startParts.hour,
    startParts.minute,
    startParts.second,
  );
  const durationMs = Math.max(
    0,
    input.scheduledEndAt.getTime() - input.scheduledStartAt.getTime(),
  );
  return {
    dateKey,
    startAt,
    endAt: new Date(startAt.getTime() + durationMs),
  };
}

export function expandOccurrences(
  input: ShiftRecurrenceInput,
  from: Date,
  to: Date,
  limit = 31,
): ShiftOccurrence[] {
  const timeZone = resolveShiftTimeZone(input);
  const fromKey = zonedDateKey(from, timeZone);
  const toKey = zonedDateKey(to, timeZone);
  const startKey = zonedDateKey(input.scheduledStartAt, timeZone);
  const seriesEndKey = input.recurrenceEndAt
    ? zonedDateKey(input.recurrenceEndAt, timeZone)
    : toKey;

  if (!isRecurringShift(input.recurrenceType)) {
    const oneOff = occurrenceOnDate(input, startKey);
    if (
      oneOff &&
      oneOff.endAt.getTime() >= from.getTime() &&
      oneOff.startAt.getTime() <= to.getTime()
    ) {
      return [oneOff];
    }
    return [];
  }

  let cursor = fromKey < startKey ? startKey : fromKey;
  const last = seriesEndKey < toKey ? seriesEndKey : toKey;
  const results: ShiftOccurrence[] = [];
  while (cursor <= last && results.length < limit) {
    const occurrence = occurrenceOnDate(input, cursor);
    if (
      occurrence &&
      occurrence.endAt.getTime() >= from.getTime() &&
      occurrence.startAt.getTime() <= to.getTime()
    ) {
      results.push(occurrence);
    }
    cursor = addCalendarDays(cursor, 1);
  }
  return results;
}

export function currentOccurrence(
  input: ShiftRecurrenceInput,
  now: Date,
  earlyMs: number,
  graceMs: number,
): ShiftOccurrence | null {
  const timeZone = resolveShiftTimeZone(input);
  const todayKey = zonedDateKey(now, timeZone);
  const yesterdayKey = addCalendarDays(todayKey, -1);
  const tomorrowKey = addCalendarDays(todayKey, 1);

  for (const dateKey of [yesterdayKey, todayKey, tomorrowKey]) {
    const occurrence = occurrenceOnDate(input, dateKey);
    if (!occurrence) {
      continue;
    }
    const windowStart = new Date(occurrence.startAt.getTime() - earlyMs);
    const windowEnd = new Date(occurrence.endAt.getTime() + graceMs);
    if (now >= windowStart && now <= windowEnd) {
      return occurrence;
    }
  }
  return null;
}

export function recurrencesOverlap(
  left: ShiftRecurrenceInput,
  right: ShiftRecurrenceInput,
  from: Date,
  to: Date,
): boolean {
  const leftOccurrences = expandOccurrences(left, from, to, 62);
  const rightOccurrences = expandOccurrences(right, from, to, 62);
  for (const a of leftOccurrences) {
    for (const b of rightOccurrences) {
      if (rangesOverlap(a.startAt, a.endAt, b.startAt, b.endAt)) {
        return true;
      }
    }
  }
  return false;
}
