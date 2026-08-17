import { Injectable } from '@nestjs/common';

export interface AttendanceTotalsInput {
  clockInServerAt: Date;
  clockOutServerAt: Date;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  gracePeriodMinutes: number;
  unpaidBreakMinutes: number;
  overtimeThresholdMinutes?: number | null;
  completedBreakMinutes: number;
}

export interface AttendanceTotalsResult {
  grossMinutes: number;
  totalBreakMinutes: number;
  payableMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  earlyDepartureMinutes: number;
}

export interface WorkedTimeInput {
  clockInServerAt: Date | null | undefined;
  clockOutServerAt: Date | null | undefined;
  breakSeconds?: number | null;
  breakMinutes?: number | null;
  breakHours?: number | null;
}

@Injectable()
export class AttendanceCalculationService {
  calculateTotals(input: AttendanceTotalsInput): AttendanceTotalsResult {
    const grossMinutes = this.clampMinutes(
      this.minutesBetween(input.clockInServerAt, input.clockOutServerAt),
    );
    const totalBreakMinutes = this.clampMinutes(input.completedBreakMinutes);
    const payableMinutes = this.clampMinutes(grossMinutes - totalBreakMinutes);

    const scheduledDurationMinutes = this.clampMinutes(
      this.minutesBetween(input.scheduledStartAt, input.scheduledEndAt),
    );

    const graceEndAt = new Date(
      input.scheduledStartAt.getTime() +
        this.clampMinutes(input.gracePeriodMinutes) * 60_000,
    );
    const lateMinutes =
      input.clockInServerAt.getTime() > graceEndAt.getTime()
        ? this.clampMinutes(
            this.minutesBetween(graceEndAt, input.clockInServerAt),
          )
        : 0;

    const earlyDepartureMinutes =
      input.clockOutServerAt.getTime() < input.scheduledEndAt.getTime()
        ? this.clampMinutes(
            this.minutesBetween(input.clockOutServerAt, input.scheduledEndAt),
          )
        : 0;

    const overtimeBaseline =
      scheduledDurationMinutes +
      (input.overtimeThresholdMinutes != null
        ? this.clampMinutes(input.overtimeThresholdMinutes)
        : 0);
    const overtimeMinutes = this.clampMinutes(grossMinutes - overtimeBaseline);

    return {
      grossMinutes,
      totalBreakMinutes,
      payableMinutes,
      overtimeMinutes,
      lateMinutes,
      earlyDepartureMinutes,
    };
  }

  private minutesBetween(start: Date, end: Date): number {
    return Math.floor((end.getTime() - start.getTime()) / 60_000);
  }

  private clampMinutes(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.floor(value));
  }

  calculateWorkedSeconds(input: WorkedTimeInput): number {
    const clockInMs = input.clockInServerAt?.getTime();
    const clockOutMs = input.clockOutServerAt?.getTime();
    if (!Number.isFinite(clockInMs) || !Number.isFinite(clockOutMs)) {
      return 0;
    }
    const attendanceSeconds = Math.max(0, (clockOutMs! - clockInMs!) / 1000);
    const breakSeconds = this.normaliseBreakSeconds(input);
    return Math.max(0, attendanceSeconds - breakSeconds);
  }

  calculateWorkedMinutes(input: WorkedTimeInput): number {
    return this.calculateWorkedSeconds(input) / 60;
  }

  calculateWorkedHours(input: WorkedTimeInput, precision = 2): number {
    return this.roundHoursFromSeconds(
      this.calculateWorkedSeconds(input),
      precision,
    );
  }

  calculateDailyTotal(workedSecondsValues: number[]): number {
    return this.sumSeconds(workedSecondsValues);
  }

  calculateOfficerTotal(workedSecondsValues: number[]): number {
    return this.sumSeconds(workedSecondsValues);
  }

  calculateSiteTotal(workedSecondsValues: number[]): number {
    return this.sumSeconds(workedSecondsValues);
  }

  calculateOrganizationTotal(workedSecondsValues: number[]): number {
    return this.sumSeconds(workedSecondsValues);
  }

  calculateAverageHours(
    totalWorkedSeconds: number,
    divisor: number,
    precision = 2,
  ): number {
    if (!Number.isFinite(divisor) || divisor <= 0) {
      return 0;
    }
    const averageSeconds = this.sumSeconds([totalWorkedSeconds]) / divisor;
    return this.roundHoursFromSeconds(averageSeconds, precision);
  }

  roundHoursFromSeconds(seconds: number, precision = 2): number {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return 0;
    }
    return Number((seconds / 3600).toFixed(precision));
  }

  private sumSeconds(values: number[]): number {
    return values.reduce((sum, value) => {
      if (!Number.isFinite(value)) return sum;
      return sum + Math.max(0, value);
    }, 0);
  }

  private normaliseBreakSeconds(input: WorkedTimeInput): number {
    if (input.breakSeconds != null && Number.isFinite(input.breakSeconds)) {
      return Math.max(0, input.breakSeconds);
    }
    if (input.breakMinutes != null && Number.isFinite(input.breakMinutes)) {
      return Math.max(0, input.breakMinutes * 60);
    }
    if (input.breakHours != null && Number.isFinite(input.breakHours)) {
      return Math.max(0, input.breakHours * 3600);
    }
    return 0;
  }
}
