import type {
  Assignment,
  Attendance,
  AttendanceEvent,
  BreakStatus,
  SecuritySite,
  Shift,
  ShiftBreak,
} from '../../../../generated/prisma/client';

function decimalToNumber(
  value: { toString(): string } | number | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return Number(value);
}

type BreakSummary = Pick<
  ShiftBreak,
  | 'id'
  | 'type'
  | 'status'
  | 'startedAtServer'
  | 'endedAtServer'
  | 'durationMinutes'
>;

export function toAttendanceResponse(
  attendance: Attendance & {
    assignment?: Pick<Assignment, 'id' | 'status' | 'officerId'> | null;
    shift?: Pick<
      Shift,
      'id' | 'title' | 'scheduledStartAt' | 'scheduledEndAt' | 'status'
    > | null;
    site?: Pick<SecuritySite, 'id' | 'name' | 'code'> | null;
    breaks?: BreakSummary[];
    events?: AttendanceEvent[];
  },
  options?: { includeEvents?: boolean; elapsedMinutes?: number },
) {
  const activeBreak = attendance.breaks?.find(
    (b: BreakSummary) => b.status === ('ACTIVE' as BreakStatus),
  );

  return {
    id: attendance.id,
    organisationId: attendance.organisationId,
    assignmentId: attendance.assignmentId,
    officerId: attendance.officerId,
    shiftId: attendance.shiftId,
    siteId: attendance.siteId,
    status: attendance.status,
    clockInDeviceAt: attendance.clockInDeviceAt?.toISOString() ?? null,
    clockInServerAt: attendance.clockInServerAt?.toISOString() ?? null,
    clockOutDeviceAt: attendance.clockOutDeviceAt?.toISOString() ?? null,
    clockOutServerAt: attendance.clockOutServerAt?.toISOString() ?? null,
    clockInOutsideGeofence: attendance.clockInOutsideGeofence,
    clockOutOutsideGeofence: attendance.clockOutOutsideGeofence,
    clockInDistanceMeters: decimalToNumber(attendance.clockInDistanceMeters),
    clockOutDistanceMeters: decimalToNumber(attendance.clockOutDistanceMeters),
    clockInAccuracyMeters: decimalToNumber(attendance.clockInAccuracyMeters),
    clockOutAccuracyMeters: decimalToNumber(attendance.clockOutAccuracyMeters),
    clockInReason: attendance.clockInReason,
    clockOutReason: attendance.clockOutReason,
    grossMinutes: attendance.grossMinutes,
    totalBreakMinutes: attendance.totalBreakMinutes,
    payableMinutes: attendance.payableMinutes,
    overtimeMinutes: attendance.overtimeMinutes,
    lateMinutes: attendance.lateMinutes,
    earlyDepartureMinutes: attendance.earlyDepartureMinutes,
    finalShiftNote: attendance.finalShiftNote,
    approvalRequestedAt: attendance.approvalRequestedAt?.toISOString() ?? null,
    reviewedAt: attendance.reviewedAt?.toISOString() ?? null,
    reviewedByUserId: attendance.reviewedByUserId,
    reviewReason: attendance.reviewReason,
    localAttendanceId: attendance.localAttendanceId,
    createdAt: attendance.createdAt.toISOString(),
    updatedAt: attendance.updatedAt.toISOString(),
    elapsedMinutes: options?.elapsedMinutes,
    assignment: attendance.assignment
      ? {
          id: attendance.assignment.id,
          status: attendance.assignment.status,
          officerId: attendance.assignment.officerId,
        }
      : undefined,
    shift: attendance.shift
      ? {
          id: attendance.shift.id,
          title: attendance.shift.title,
          status: attendance.shift.status,
          scheduledStartAt: attendance.shift.scheduledStartAt.toISOString(),
          scheduledEndAt: attendance.shift.scheduledEndAt.toISOString(),
        }
      : undefined,
    site: attendance.site
      ? {
          id: attendance.site.id,
          name: attendance.site.name,
          code: attendance.site.code,
        }
      : undefined,
    activeBreak: activeBreak
      ? {
          id: activeBreak.id,
          type: activeBreak.type,
          status: activeBreak.status,
          startedAtServer: activeBreak.startedAtServer?.toISOString() ?? null,
        }
      : null,
    events: options?.includeEvents
      ? attendance.events?.map((event: AttendanceEvent) => ({
          id: event.id,
          type: event.type,
          actorUserId: event.actorUserId,
          deviceTimestamp: event.deviceTimestamp?.toISOString() ?? null,
          serverTimestamp: event.serverTimestamp.toISOString(),
          reason: event.reason,
          createdAt: event.createdAt.toISOString(),
        }))
      : undefined,
  };
}
