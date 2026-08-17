import type {
  Assignment,
  Attendance,
  AttendanceEvent,
  BreakStatus,
  Device,
  OfficerProfile,
  SecuritySite,
  Shift,
  ShiftBreak,
  User,
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

type OfficerWithUser = Pick<
  OfficerProfile,
  'id' | 'officerNumber' | 'employmentStatus'
> & {
  user?: Pick<
    User,
    | 'id'
    | 'employeeId'
    | 'firstName'
    | 'lastName'
    | 'displayName'
    | 'avatarUrl'
    | 'email'
    | 'phone'
  > | null;
};

type EventWithDevice = AttendanceEvent & {
  device?: Pick<
    Device,
    | 'id'
    | 'platform'
    | 'deviceName'
    | 'manufacturer'
    | 'model'
    | 'appVersion'
    | 'status'
    | 'installationId'
  > | null;
};

export function toAttendanceResponse(
  attendance: Attendance & {
    assignment?: Pick<
      Assignment,
      'id' | 'status' | 'officerId' | 'supervisorId'
    > | null;
    officer?: OfficerWithUser | null;
    shift?: Pick<
      Shift,
      | 'id'
      | 'title'
      | 'scheduledStartAt'
      | 'scheduledEndAt'
      | 'status'
      | 'unpaidBreakMinutes'
      | 'gracePeriodMinutes'
      | 'overtimeThresholdMinutes'
    > | null;
    site?:
      | (Pick<
          SecuritySite,
          | 'id'
          | 'name'
          | 'code'
          | 'address'
          | 'clockInRadiusMeters'
          | 'clockOutRadiusMeters'
          | 'checkpointDefaultRadiusMeters'
          | 'clockInOutsideGeofencePolicy'
          | 'clockOutOutsideGeofencePolicy'
          | 'minimumGpsAccuracyMeters'
          | 'requiresClockInSelfie'
          | 'requiresClockOutSelfie'
          | 'requiresPatrol'
          | 'requiresFinalShiftNote'
          | 'instructions'
          | 'status'
        > & {
          latitude?: { toString(): string } | number | null;
          longitude?: { toString(): string } | number | null;
        })
      | null;
    breaks?: BreakSummary[];
    events?: EventWithDevice[];
  },
  options?: { includeEvents?: boolean; elapsedMinutes?: number },
) {
  const activeBreak = attendance.breaks?.find(
    (b: BreakSummary) => b.status === ('ACTIVE' as BreakStatus),
  );

  const clockInEvent = attendance.events?.find((e) => e.type === 'CLOCK_IN');
  const device =
    clockInEvent?.device ??
    attendance.events?.find((e) => e.device)?.device ??
    null;

  return {
    id: attendance.id,
    organisationId: attendance.organisationId,
    assignmentId: attendance.assignmentId,
    occurrenceDate:
      attendance.occurrenceDate instanceof Date
        ? attendance.occurrenceDate.toISOString().slice(0, 10)
        : null,
    officerId: attendance.officerId,
    shiftId: attendance.shiftId,
    siteId: attendance.siteId,
    status: attendance.status,
    clockInDeviceAt: attendance.clockInDeviceAt?.toISOString() ?? null,
    clockInServerAt: attendance.clockInServerAt?.toISOString() ?? null,
    clockOutDeviceAt: attendance.clockOutDeviceAt?.toISOString() ?? null,
    clockOutServerAt: attendance.clockOutServerAt?.toISOString() ?? null,
    clockInLatitude: decimalToNumber(attendance.clockInLatitude),
    clockInLongitude: decimalToNumber(attendance.clockInLongitude),
    clockOutLatitude: decimalToNumber(attendance.clockOutLatitude),
    clockOutLongitude: decimalToNumber(attendance.clockOutLongitude),
    clockInOutsideGeofence: attendance.clockInOutsideGeofence,
    clockOutOutsideGeofence: attendance.clockOutOutsideGeofence,
    geofenceEnforcementDisabled:
      attendance.geofenceEnforcementDisabled ?? false,
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
    clockInEvidenceId: attendance.clockInEvidenceId ?? null,
    clockOutEvidenceId: attendance.clockOutEvidenceId ?? null,
    createdAt: attendance.createdAt.toISOString(),
    updatedAt: attendance.updatedAt.toISOString(),
    elapsedMinutes: options?.elapsedMinutes,
    gpsVerified: !attendance.clockInOutsideGeofence,
    isLate: (attendance.lateMinutes ?? 0) > 0,
    isOnBreak: Boolean(activeBreak),
    assignment: attendance.assignment
      ? {
          id: attendance.assignment.id,
          status: attendance.assignment.status,
          officerId: attendance.assignment.officerId,
          supervisorId: attendance.assignment.supervisorId ?? null,
        }
      : undefined,
    officer: attendance.officer
      ? {
          id: attendance.officer.id,
          officerNumber: attendance.officer.officerNumber,
          employmentStatus: attendance.officer.employmentStatus,
          user: attendance.officer.user
            ? {
                id: attendance.officer.user.id,
                employeeId: attendance.officer.user.employeeId,
                firstName: attendance.officer.user.firstName,
                lastName: attendance.officer.user.lastName,
                displayName: attendance.officer.user.displayName,
                avatarUrl: attendance.officer.user.avatarUrl,
                email: attendance.officer.user.email,
                phone: attendance.officer.user.phone,
              }
            : null,
        }
      : undefined,
    shift: attendance.shift
      ? {
          id: attendance.shift.id,
          title: attendance.shift.title,
          status: attendance.shift.status,
          scheduledStartAt: attendance.shift.scheduledStartAt.toISOString(),
          scheduledEndAt: attendance.shift.scheduledEndAt.toISOString(),
          unpaidBreakMinutes: attendance.shift.unpaidBreakMinutes ?? null,
          gracePeriodMinutes: attendance.shift.gracePeriodMinutes ?? null,
          overtimeThresholdMinutes:
            attendance.shift.overtimeThresholdMinutes ?? null,
        }
      : undefined,
    site: attendance.site
      ? {
          id: attendance.site.id,
          name: attendance.site.name,
          code: attendance.site.code,
          address: attendance.site.address,
          latitude: decimalToNumber(attendance.site.latitude),
          longitude: decimalToNumber(attendance.site.longitude),
          clockInRadiusMeters: attendance.site.clockInRadiusMeters ?? null,
          clockOutRadiusMeters: attendance.site.clockOutRadiusMeters ?? null,
          checkpointDefaultRadiusMeters:
            attendance.site.checkpointDefaultRadiusMeters ?? null,
          clockInOutsideGeofencePolicy:
            attendance.site.clockInOutsideGeofencePolicy ?? null,
          clockOutOutsideGeofencePolicy:
            attendance.site.clockOutOutsideGeofencePolicy ?? null,
          minimumGpsAccuracyMeters:
            attendance.site.minimumGpsAccuracyMeters ?? null,
          requiresClockInSelfie: attendance.site.requiresClockInSelfie ?? false,
          requiresClockOutSelfie:
            attendance.site.requiresClockOutSelfie ?? false,
          requiresPatrol: attendance.site.requiresPatrol ?? false,
          requiresFinalShiftNote:
            attendance.site.requiresFinalShiftNote ?? false,
          instructions: attendance.site.instructions ?? null,
          status: attendance.site.status,
        }
      : undefined,
    device: device
      ? {
          id: device.id,
          platform: device.platform,
          deviceName: device.deviceName,
          manufacturer: device.manufacturer,
          model: device.model,
          appVersion: device.appVersion,
          status: device.status,
          installationId: device.installationId,
        }
      : null,
    activeBreak: activeBreak
      ? {
          id: activeBreak.id,
          type: activeBreak.type,
          status: activeBreak.status,
          startedAtServer: activeBreak.startedAtServer?.toISOString() ?? null,
          endedAtServer: activeBreak.endedAtServer?.toISOString() ?? null,
          durationMinutes: activeBreak.durationMinutes,
        }
      : null,
    breaks: attendance.breaks?.map((item) => ({
      id: item.id,
      type: item.type,
      status: item.status,
      startedAtServer: item.startedAtServer?.toISOString() ?? null,
      endedAtServer: item.endedAtServer?.toISOString() ?? null,
      durationMinutes: item.durationMinutes,
    })),
    events: options?.includeEvents
      ? attendance.events?.map((event: EventWithDevice) => ({
          id: event.id,
          type: event.type,
          actorUserId: event.actorUserId,
          deviceId: event.deviceId,
          deviceTimestamp: event.deviceTimestamp?.toISOString() ?? null,
          serverTimestamp: event.serverTimestamp.toISOString(),
          latitude: decimalToNumber(event.latitude),
          longitude: decimalToNumber(event.longitude),
          accuracyMeters: decimalToNumber(event.accuracyMeters),
          reason: event.reason,
          createdAt: event.createdAt.toISOString(),
          device: event.device
            ? {
                id: event.device.id,
                platform: event.device.platform,
                deviceName: event.device.deviceName,
                status: event.device.status,
              }
            : null,
        }))
      : undefined,
  };
}
