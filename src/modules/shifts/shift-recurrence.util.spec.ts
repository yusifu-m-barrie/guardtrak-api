import { RecurrenceType } from '../../../generated/prisma/client';
import {
  calendarOccurrenceNear,
  currentOccurrence,
  expandOccurrences,
  occurrenceFromClientDate,
  occurrenceOnDate,
  recurrencesOverlap,
  resolveActiveOrUpcomingToday,
  resolveClockInOccurrence,
  resolveDutyOccurrence,
  todayOccurrence,
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

  it('projects NONE one-off wall-clock times onto today for clock-in', () => {
    const oneOff = {
      recurrenceType: RecurrenceType.NONE,
      scheduledStartAt: new Date('2026-08-15T14:00:00.000Z'),
      scheduledEndAt: new Date('2026-08-15T20:27:00.000Z'),
      timezone: 'Africa/Freetown',
    };
    const now = new Date('2026-08-20T16:30:00.000Z');
    const occ = resolveClockInOccurrence(
      oneOff,
      now,
      2 * 60 * 60_000,
      15 * 60_000,
    );
    expect(occ?.dateKey).toBe('2026-08-20');
    expect(occ?.startAt.toISOString()).toBe('2026-08-20T14:00:00.000Z');
    expect(occ?.endAt.toISOString()).toBe('2026-08-20T20:27:00.000Z');
  });

  it('resolves overnight DAILY duty (17:00–00:00) on the following morning', () => {
    const overnight = {
      recurrenceType: RecurrenceType.DAILY,
      scheduledStartAt: new Date('2026-08-20T17:00:00.000Z'),
      scheduledEndAt: new Date('2026-08-21T00:00:00.000Z'),
      timezone: 'Africa/Freetown',
    };
    const duringShift = new Date('2026-08-20T19:30:00.000Z');
    const afterMidnight = new Date('2026-08-20T23:30:00.000Z');
    const nextMorningStillOnDuty = new Date('2026-08-20T23:45:00.000Z');

    expect(
      resolveClockInOccurrence(overnight, duringShift, 30 * 60_000, 15 * 60_000)
        ?.dateKey,
    ).toBe('2026-08-20');
    expect(
      resolveClockInOccurrence(
        overnight,
        afterMidnight,
        30 * 60_000,
        15 * 60_000,
      )?.dateKey,
    ).toBe('2026-08-20');
    expect(
      currentOccurrence(
        overnight,
        nextMorningStillOnDuty,
        30 * 60_000,
        15 * 60_000,
      )?.dateKey,
    ).toBe('2026-08-20');

    const nextDay = occurrenceOnDate(overnight, '2026-08-21');
    expect(nextDay?.startAt.toISOString()).toBe('2026-08-21T17:00:00.000Z');
    expect(nextDay?.endAt.toISOString()).toBe('2026-08-22T00:00:00.000Z');
  });

  it('resolves a DAILY occurrence on the calendar day even before the duty window', () => {
    const now = new Date('2026-08-18T12:00:00.000Z'); // 08:00 America/New_York
    expect(
      currentOccurrence(daily, now, 2 * 60 * 60_000, 15 * 60_000),
    ).toBeNull();
    expect(calendarOccurrenceNear(daily, now)?.dateKey).toBe('2026-08-18');
    expect(todayOccurrence(daily, now)?.dateKey).toBe('2026-08-18');
    expect(
      resolveClockInOccurrence(daily, now, 2 * 60 * 60_000, 15 * 60_000)
        ?.dateKey,
    ).toBe('2026-08-18');
    expect(
      resolveActiveOrUpcomingToday(daily, now, 2 * 60 * 60_000, 15 * 60_000)
        ?.dateKey,
    ).toBe('2026-08-18');
    expect(occurrenceFromClientDate(daily, now, '2026-08-18')?.dateKey).toBe(
      '2026-08-18',
    );
    expect(occurrenceFromClientDate(daily, now, '2026-08-21')).toBeNull();
    expect(
      resolveDutyOccurrence(daily, now, 2 * 60 * 60_000, 15 * 60_000, true)
        ?.dateKey,
    ).toBe('2026-08-18');
    expect(
      resolveDutyOccurrence(daily, now, 2 * 60 * 60_000, 15 * 60_000, false),
    ).toBeNull();
  });

  it('expands DAILY occurrences for today, tomorrow, and the next day', () => {
    const rows = expandOccurrences(
      daily,
      new Date('2026-08-17T00:00:00.000Z'),
      new Date('2026-08-20T00:00:00.000Z'),
    );
    expect(rows.map((row) => row.dateKey)).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
    ]);
    expect(rows[0].startAt.toISOString()).toBe('2026-08-17T18:00:00.000Z');
    expect(rows[2].endAt.toISOString()).toBe('2026-08-19T21:00:00.000Z');
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
