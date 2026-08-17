import { RecurrenceType } from '../../../../generated/prisma/client';
import type {
  Assignment,
  OfficerProfile,
  Prisma,
  SecuritySite,
  Shift,
  SupervisorProfile,
  User,
} from '../../../../generated/prisma/client';

/** Maps assignment rows for API responses (includes shift site for officer clock-in). */

type OfficerSummary = Pick<
  OfficerProfile,
  'id' | 'officerNumber' | 'employmentStatus'
> & {
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'employeeId'> | null;
};

type SupervisorSummary = Pick<SupervisorProfile, 'id' | 'supervisorNumber'> & {
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'employeeId'> | null;
};

type SiteForAssignment = Pick<
  SecuritySite,
  | 'id'
  | 'clientId'
  | 'name'
  | 'code'
  | 'address'
  | 'latitude'
  | 'longitude'
  | 'clockInRadiusMeters'
  | 'clockOutRadiusMeters'
  | 'checkpointDefaultRadiusMeters'
  | 'minimumGpsAccuracyMeters'
  | 'clockInOutsideGeofencePolicy'
  | 'clockOutOutsideGeofencePolicy'
  | 'requiresClockInSelfie'
  | 'requiresClockOutSelfie'
  | 'requiresPatrol'
  | 'requiresFinalShiftNote'
  | 'instructions'
  | 'status'
>;

type ShiftSummary = Pick<
  Shift,
  | 'id'
  | 'title'
  | 'status'
  | 'scheduledStartAt'
  | 'scheduledEndAt'
  | 'siteId'
  | 'gracePeriodMinutes'
  | 'unpaidBreakMinutes'
  | 'recurrenceType'
  | 'recurrenceEndAt'
  | 'recurrenceDaysOfWeek'
  | 'timezone'
> & {
  site?: SiteForAssignment | null;
  organisation?: { timezone: string } | null;
};

export type AssignmentResponseOptions = {
  occurrenceDate?: string | null;
  occurrenceStartAt?: Date | null;
  occurrenceEndAt?: Date | null;
  geofenceEnforcementEnabled?: boolean;
  timezone?: string | null;
};

function decimalToNumber(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

function toSitePayload(site: SiteForAssignment) {
  return {
    id: site.id,
    clientId: site.clientId,
    name: site.name,
    code: site.code,
    address: site.address,
    latitude: decimalToNumber(site.latitude),
    longitude: decimalToNumber(site.longitude),
    clockInRadiusMeters: site.clockInRadiusMeters,
    clockOutRadiusMeters: site.clockOutRadiusMeters,
    checkpointDefaultRadiusMeters: site.checkpointDefaultRadiusMeters,
    minimumGpsAccuracyMeters: site.minimumGpsAccuracyMeters,
    clockInOutsideGeofencePolicy: site.clockInOutsideGeofencePolicy,
    clockOutOutsideGeofencePolicy: site.clockOutOutsideGeofencePolicy,
    requiresClockInSelfie: site.requiresClockInSelfie,
    requiresClockOutSelfie: site.requiresClockOutSelfie,
    requiresPatrol: site.requiresPatrol,
    requiresFinalShiftNote: site.requiresFinalShiftNote,
    instructions: site.instructions,
    status: site.status,
  };
}

function toRecurrencePayload(
  shift: ShiftSummary | null | undefined,
  timezone: string | null,
) {
  const type = shift?.recurrenceType ?? RecurrenceType.NONE;
  return {
    type,
    startAt: shift?.scheduledStartAt?.toISOString() ?? null,
    endAt: shift?.recurrenceEndAt?.toISOString() ?? null,
    daysOfWeek: shift?.recurrenceDaysOfWeek ?? [],
    timezone,
  };
}

export function toAssignmentResponse(
  assignment: Assignment & {
    notes?: string | null;
    isActive?: boolean;
    createdBy?: Pick<
      User,
      'id' | 'firstName' | 'lastName' | 'displayName' | 'employeeId' | 'role'
    > | null;
    officer?: OfficerSummary | null;
    supervisor?: SupervisorSummary | null;
    shift?: ShiftSummary | null;
  },
  options?: AssignmentResponseOptions,
) {
  const site = assignment.shift?.site
    ? toSitePayload(assignment.shift.site)
    : undefined;
  const timezone =
    options?.timezone ??
    assignment.shift?.timezone ??
    assignment.shift?.organisation?.timezone ??
    null;
  const occurrenceStartAt =
    options?.occurrenceStartAt ?? assignment.shift?.scheduledStartAt ?? null;
  const occurrenceEndAt =
    options?.occurrenceEndAt ?? assignment.shift?.scheduledEndAt ?? null;

  return {
    id: assignment.id,
    organisationId: assignment.organisationId,
    shiftId: assignment.shiftId,
    officerId: assignment.officerId,
    supervisorId: assignment.supervisorId,
    status: assignment.status,
    notes: assignment.notes ?? null,
    isActive: assignment.isActive ?? true,
    assignedAt: assignment.assignedAt.toISOString(),
    confirmedAt: assignment.confirmedAt?.toISOString() ?? null,
    startedAt: assignment.startedAt?.toISOString() ?? null,
    completedAt: assignment.completedAt?.toISOString() ?? null,
    cancelledAt: assignment.cancelledAt?.toISOString() ?? null,
    cancellationReason: assignment.cancellationReason,
    replacedAssignmentId: assignment.replacedAssignmentId,
    createdByUserId: assignment.createdByUserId,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
    occurrenceDate: options?.occurrenceDate ?? null,
    occurrenceStartAt: occurrenceStartAt?.toISOString() ?? null,
    occurrenceEndAt: occurrenceEndAt?.toISOString() ?? null,
    timezone,
    geofenceEnforcementEnabled: options?.geofenceEnforcementEnabled ?? true,
    recurrence: toRecurrencePayload(assignment.shift, timezone),
    /** Hydrated site for officer clock-in / geofence (officers lack site:read). */
    site,
    createdBy: assignment.createdBy
      ? {
          id: assignment.createdBy.id,
          firstName: assignment.createdBy.firstName,
          lastName: assignment.createdBy.lastName,
          displayName: assignment.createdBy.displayName,
          employeeId: assignment.createdBy.employeeId,
          role: assignment.createdBy.role,
        }
      : undefined,
    officer: assignment.officer
      ? {
          id: assignment.officer.id,
          officerNumber: assignment.officer.officerNumber,
          employmentStatus: assignment.officer.employmentStatus,
          user: assignment.officer.user
            ? {
                id: assignment.officer.user.id,
                firstName: assignment.officer.user.firstName,
                lastName: assignment.officer.user.lastName,
                employeeId: assignment.officer.user.employeeId,
              }
            : undefined,
        }
      : undefined,
    supervisor: assignment.supervisor
      ? {
          id: assignment.supervisor.id,
          supervisorNumber: assignment.supervisor.supervisorNumber,
          user: assignment.supervisor.user
            ? {
                id: assignment.supervisor.user.id,
                firstName: assignment.supervisor.user.firstName,
                lastName: assignment.supervisor.user.lastName,
                employeeId: assignment.supervisor.user.employeeId,
              }
            : undefined,
        }
      : undefined,
    shift: assignment.shift
      ? {
          id: assignment.shift.id,
          title: assignment.shift.title,
          status: assignment.shift.status,
          siteId: assignment.shift.siteId,
          gracePeriodMinutes: assignment.shift.gracePeriodMinutes,
          unpaidBreakMinutes: assignment.shift.unpaidBreakMinutes,
          scheduledStartAt:
            occurrenceStartAt?.toISOString() ??
            assignment.shift.scheduledStartAt.toISOString(),
          scheduledEndAt:
            occurrenceEndAt?.toISOString() ??
            assignment.shift.scheduledEndAt.toISOString(),
          recurrenceType: assignment.shift.recurrenceType,
          recurrenceEndAt:
            assignment.shift.recurrenceEndAt?.toISOString() ?? null,
          recurrenceDaysOfWeek: assignment.shift.recurrenceDaysOfWeek ?? [],
          timezone,
          site,
        }
      : undefined,
  };
}
