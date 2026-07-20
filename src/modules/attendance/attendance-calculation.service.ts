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

@Injectable()
export class AttendanceCalculationService {
  calculateTotals(input: AttendanceTotalsInput): AttendanceTotalsResult {
    const grossMinutes = this.clampMinutes(
      this.minutesBetween(input.clockInServerAt, input.clockOutServerAt),
    );
    const totalBreakMinutes = this.clampMinutes(input.completedBreakMinutes);
    const payableMinutes = this.clampMinutes(
      grossMinutes - this.clampMinutes(input.unpaidBreakMinutes),
    );

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
}
