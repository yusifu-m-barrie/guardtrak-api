import { AttendanceCalculationService } from './attendance-calculation.service';

describe('AttendanceCalculationService', () => {
  const service = new AttendanceCalculationService();

  const baseInput = {
    scheduledStartAt: new Date('2026-07-18T08:00:00.000Z'),
    scheduledEndAt: new Date('2026-07-18T16:00:00.000Z'),
    gracePeriodMinutes: 15,
    unpaidBreakMinutes: 30,
    completedBreakMinutes: 25,
    overtimeThresholdMinutes: 0,
  };

  it('calculates standard same-day shift totals', () => {
    const result = service.calculateTotals({
      ...baseInput,
      clockInServerAt: new Date('2026-07-18T08:00:00.000Z'),
      clockOutServerAt: new Date('2026-07-18T16:00:00.000Z'),
    });

    expect(result).toEqual({
      grossMinutes: 480,
      totalBreakMinutes: 25,
      payableMinutes: 450,
      overtimeMinutes: 0,
      lateMinutes: 0,
      earlyDepartureMinutes: 0,
    });
  });

  it('calculates overnight shift gross minutes', () => {
    const result = service.calculateTotals({
      ...baseInput,
      scheduledStartAt: new Date('2026-07-18T18:00:00.000Z'),
      scheduledEndAt: new Date('2026-07-19T06:00:00.000Z'),
      clockInServerAt: new Date('2026-07-18T18:00:00.000Z'),
      clockOutServerAt: new Date('2026-07-19T06:00:00.000Z'),
    });

    expect(result.grossMinutes).toBe(720);
    expect(result.payableMinutes).toBe(690);
    expect(result.overtimeMinutes).toBe(0);
  });

  it('calculates late minutes after grace period', () => {
    const result = service.calculateTotals({
      ...baseInput,
      clockInServerAt: new Date('2026-07-18T08:20:00.000Z'),
      clockOutServerAt: new Date('2026-07-18T16:00:00.000Z'),
    });

    expect(result.lateMinutes).toBe(5);
    expect(result.grossMinutes).toBe(460);
    expect(result.payableMinutes).toBe(430);
  });

  it('calculates early departure minutes', () => {
    const result = service.calculateTotals({
      ...baseInput,
      clockInServerAt: new Date('2026-07-18T08:00:00.000Z'),
      clockOutServerAt: new Date('2026-07-18T15:30:00.000Z'),
    });

    expect(result.earlyDepartureMinutes).toBe(30);
    expect(result.grossMinutes).toBe(450);
    expect(result.payableMinutes).toBe(420);
  });

  it('calculates overtime beyond scheduled duration and threshold', () => {
    const result = service.calculateTotals({
      ...baseInput,
      clockInServerAt: new Date('2026-07-18T08:00:00.000Z'),
      clockOutServerAt: new Date('2026-07-18T17:00:00.000Z'),
      overtimeThresholdMinutes: 30,
    });

    expect(result.grossMinutes).toBe(540);
    expect(result.overtimeMinutes).toBe(30);
    expect(result.payableMinutes).toBe(510);
  });

  it('clamps negative derived values to zero', () => {
    const result = service.calculateTotals({
      ...baseInput,
      clockInServerAt: new Date('2026-07-18T07:45:00.000Z'),
      clockOutServerAt: new Date('2026-07-18T16:30:00.000Z'),
      unpaidBreakMinutes: 600,
      completedBreakMinutes: 0,
    });

    expect(result.payableMinutes).toBe(0);
    expect(result.lateMinutes).toBe(0);
    expect(result.earlyDepartureMinutes).toBe(0);
  });

  describe('worked time precision (seconds-based)', () => {
    it('calculates no-break worked hours from raw seconds', () => {
      const workedSeconds = service.calculateWorkedSeconds({
        clockInServerAt: new Date('2026-07-18T11:22:00.000Z'),
        clockOutServerAt: new Date('2026-07-18T11:40:00.000Z'),
      });
      expect(workedSeconds).toBe(1080);
      expect(service.roundHoursFromSeconds(workedSeconds)).toBe(0.3);
    });

    it('calculates one break from decimal hours accurately', () => {
      const workedSeconds = service.calculateWorkedSeconds({
        clockInServerAt: new Date('2026-07-18T11:22:00.000Z'),
        clockOutServerAt: new Date('2026-07-18T11:40:00.000Z'),
        breakHours: 0.03,
      });
      expect(workedSeconds).toBeCloseTo(972, 6);
      expect(service.roundHoursFromSeconds(workedSeconds)).toBe(0.27);
    });

    it('calculates multiple breaks using combined break seconds', () => {
      const breakSeconds = 300 + 420 + 180;
      const workedSeconds = service.calculateWorkedSeconds({
        clockInServerAt: new Date('2026-07-18T08:00:00.000Z'),
        clockOutServerAt: new Date('2026-07-18T12:00:00.000Z'),
        breakSeconds,
      });
      expect(workedSeconds).toBe(13500);
      expect(service.roundHoursFromSeconds(workedSeconds)).toBe(3.75);
    });

    it('supports overnight shift worked seconds', () => {
      const workedSeconds = service.calculateWorkedSeconds({
        clockInServerAt: new Date('2026-07-18T23:30:00.000Z'),
        clockOutServerAt: new Date('2026-07-19T07:30:00.000Z'),
        breakMinutes: 45,
      });
      expect(workedSeconds).toBe(26100);
      expect(service.roundHoursFromSeconds(workedSeconds)).toBe(7.25);
    });

    it('returns zero for invalid clock-out before clock-in', () => {
      const workedSeconds = service.calculateWorkedSeconds({
        clockInServerAt: new Date('2026-07-18T11:40:00.000Z'),
        clockOutServerAt: new Date('2026-07-18T11:22:00.000Z'),
        breakMinutes: 5,
      });
      expect(workedSeconds).toBe(0);
    });

    it('returns zero-hour attendance when in/out are equal', () => {
      const workedSeconds = service.calculateWorkedSeconds({
        clockInServerAt: new Date('2026-07-18T11:22:00.000Z'),
        clockOutServerAt: new Date('2026-07-18T11:22:00.000Z'),
      });
      expect(workedSeconds).toBe(0);
      expect(service.roundHoursFromSeconds(workedSeconds)).toBe(0);
    });

    it('calculates minute-based breaks without intermediate rounding', () => {
      const workedSeconds = service.calculateWorkedSeconds({
        clockInServerAt: new Date('2026-07-18T08:00:00.000Z'),
        clockOutServerAt: new Date('2026-07-18T09:00:00.000Z'),
        breakMinutes: 7.5,
      });
      expect(workedSeconds).toBe(3150);
      expect(service.roundHoursFromSeconds(workedSeconds)).toBe(0.88);
    });

    it('calculates large-range monthly totals from raw seconds', () => {
      const daily = service.calculateWorkedSeconds({
        clockInServerAt: new Date('2026-07-01T08:00:00.000Z'),
        clockOutServerAt: new Date('2026-07-01T17:00:00.000Z'),
        breakMinutes: 60,
      });
      const monthTotalSeconds = service.calculateOrganizationTotal(
        Array.from({ length: 31 }, () => daily),
      );
      expect(monthTotalSeconds).toBe(892800);
      expect(service.roundHoursFromSeconds(monthTotalSeconds)).toBe(248);
      expect(service.calculateAverageHours(monthTotalSeconds, 31)).toBe(8);
    });

    it('totals match sum of raw worked time', () => {
      const sessions = [
        service.calculateWorkedSeconds({
          clockInServerAt: new Date('2026-07-18T08:00:00.000Z'),
          clockOutServerAt: new Date('2026-07-18T08:20:00.000Z'),
        }),
        service.calculateWorkedSeconds({
          clockInServerAt: new Date('2026-07-18T09:00:00.000Z'),
          clockOutServerAt: new Date('2026-07-18T09:20:00.000Z'),
        }),
      ];
      const totalSeconds = service.calculateOfficerTotal(sessions);
      const roundedFromTotal = service.roundHoursFromSeconds(totalSeconds);
      const sumOfRounded = sessions
        .map((seconds) => service.roundHoursFromSeconds(seconds))
        .reduce((a, b) => a + b, 0);
      expect(totalSeconds).toBe(2400);
      expect(roundedFromTotal).toBe(0.67);
      expect(sumOfRounded).not.toBe(roundedFromTotal);
    });
  });
});
