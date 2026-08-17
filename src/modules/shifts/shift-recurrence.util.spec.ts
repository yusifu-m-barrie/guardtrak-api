import { RecurrenceType } from '../../../generated/prisma/client';
import {
  currentOccurrence,
  expandOccurrences,
  occurrenceOnDate,
  recurrencesOverlap,
} from './shift-recurrence.util';

describe('shift-recurrence.util', () => {
  const daily = {
    recurrenceType: RecurrenceType.DAILY,
    scheduledStartAt: new Date('2026-08-17T18:00:00.000Z'), // 14:00 America/New_York
    scheduledEndAt: new Date('2026-08-17T21:00:00.000Z'),
    timezone: 'America/New_York',
  };

  it('expands a DAILY assignment across today and tomorrow', () => {
    const rows = expandOccurrences(
      daily,
      new Date('2026-08-17T00:00:00.000Z'),
      new Date('2026-08-19T00:00:00.000Z'),
    );
    expect(rows.map((row) => row.dateKey)).toEqual([
      '2026-08-17',
      '2026-08-18',
    ]);
    expect(rows[1].startAt.toISOString()).toBe('2026-08-18T18:00:00.000Z');
    expect(rows[1].endAt.toISOString()).toBe('2026-08-18T21:00:00.000Z');
  });

  it('respects WEEKLY weekday matching', () => {
    const weekly = {
      recurrenceType: RecurrenceType.WEEKLY,
      scheduledStartAt: new Date('2026-08-17T18:00:00.000Z'), // Monday
      scheduledEndAt: new Date('2026-08-17T21:00:00.000Z'),
      timezone: 'America/New_York',
      recurrenceDaysOfWeek: [1],
    };
    expect(occurrenceOnDate(weekly, '2026-08-17')).not.toBeNull();
    expect(occurrenceOnDate(weekly, '2026-08-18')).toBeNull();
    expect(occurrenceOnDate(weekly, '2026-08-24')).not.toBeNull();
  });

  it('rejects dates before start or after end', () => {
    const bounded = {
      ...daily,
      recurrenceEndAt: new Date('2026-08-19T21:00:00.000Z'),
    };
    expect(occurrenceOnDate(bounded, '2026-08-16')).toBeNull();
    expect(occurrenceOnDate(bounded, '2026-08-19')).not.toBeNull();
    expect(occurrenceOnDate(bounded, '2026-08-20')).toBeNull();
  });

  it('does not expand a one-off shift onto other days', () => {
    const oneOff = {
      recurrenceType: RecurrenceType.NONE,
      scheduledStartAt: daily.scheduledStartAt,
      scheduledEndAt: daily.scheduledEndAt,
      timezone: 'America/New_York',
    };
    expect(occurrenceOnDate(oneOff, '2026-08-17')).not.toBeNull();
    expect(occurrenceOnDate(oneOff, '2026-08-18')).toBeNull();
  });

  it('detects the current occurrence inside the duty window', () => {
    const now = new Date('2026-08-18T18:05:00.000Z');
    const occurrence = currentOccurrence(
      daily,
      now,
      2 * 60 * 60_000,
      15 * 60_000,
    );
    expect(occurrence?.dateKey).toBe('2026-08-18');
  });

  it('supports CUSTOM_WEEKDAYS and rejects unmatched days', () => {
    const custom = {
      recurrenceType: RecurrenceType.CUSTOM_WEEKDAYS,
      scheduledStartAt: new Date('2026-08-17T18:00:00.000Z'),
      scheduledEndAt: new Date('2026-08-17T21:00:00.000Z'),
      timezone: 'America/New_York',
      recurrenceDaysOfWeek: [1, 3, 5],
    };
    expect(occurrenceOnDate(custom, '2026-08-17')).not.toBeNull(); // Monday
    expect(occurrenceOnDate(custom, '2026-08-18')).toBeNull(); // Tuesday
    expect(occurrenceOnDate(custom, '2026-08-19')).not.toBeNull(); // Wednesday
    expect(occurrenceOnDate(custom, '2026-08-21')).not.toBeNull(); // Friday
  });

  it('detects overlapping recurring windows', () => {
    const other = {
      ...daily,
      scheduledStartAt: new Date('2026-08-17T19:00:00.000Z'),
      scheduledEndAt: new Date('2026-08-17T22:00:00.000Z'),
    };
    expect(
      recurrencesOverlap(
        daily,
        other,
        new Date('2026-08-17T00:00:00.000Z'),
        new Date('2026-08-20T00:00:00.000Z'),
      ),
    ).toBe(true);
  });
});
