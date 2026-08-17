import {
  addCalendarDays,
  endOfZonedDay,
  isValidTimeZone,
  resolveTimeZone,
  startOfZonedDay,
  zonedDateKey,
  zonedDateTime,
  zonedParts,
} from './timezone.util';

describe('timezone.util', () => {
  it('validates IANA timezones', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('Africa/Freetown')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
  });

  it('converts New York wall time to UTC', () => {
    const instant = zonedDateTime('America/New_York', 2026, 8, 17, 14, 0, 0);
    expect(instant.toISOString()).toBe('2026-08-17T18:00:00.000Z');
    expect(zonedDateKey(instant, 'America/New_York')).toBe('2026-08-17');
    expect(zonedParts(instant, 'America/New_York').hour).toBe(14);
  });

  it('builds timezone-aware day bounds', () => {
    const start = startOfZonedDay('2026-08-01', 'America/New_York');
    const end = endOfZonedDay('2026-08-01', 'America/New_York');
    expect(start.toISOString()).toBe('2026-08-01T04:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-02T03:59:59.999Z');
    expect(zonedDateKey(end, 'America/New_York')).toBe('2026-08-01');
    expect(zonedParts(end, 'America/New_York').hour).toBe(23);
  });

  it('falls back to UTC when timezone is missing', () => {
    expect(resolveTimeZone(null, null)).toBe('UTC');
    expect(addCalendarDays('2026-08-17', 1)).toBe('2026-08-18');
  });
});
