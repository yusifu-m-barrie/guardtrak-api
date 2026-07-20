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
});
