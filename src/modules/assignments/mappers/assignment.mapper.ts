import type {
  Assignment,
  OfficerProfile,
  Shift,
  SupervisorProfile,
  User,
} from '../../../../generated/prisma/client';

type OfficerSummary = Pick<
  OfficerProfile,
  'id' | 'officerNumber' | 'employmentStatus'
> & {
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'employeeId'> | null;
};

type SupervisorSummary = Pick<SupervisorProfile, 'id' | 'supervisorNumber'> & {
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'employeeId'> | null;
};

type ShiftSummary = Pick<
  Shift,
  | 'id'
  | 'title'
  | 'status'
  | 'scheduledStartAt'
  | 'scheduledEndAt'
  | 'siteId'
  | 'gracePeriodMinutes'
>;

export function toAssignmentResponse(
  assignment: Assignment & {
    officer?: OfficerSummary | null;
    supervisor?: SupervisorSummary | null;
    shift?: ShiftSummary | null;
  },
) {
  return {
    id: assignment.id,
    organisationId: assignment.organisationId,
    shiftId: assignment.shiftId,
    officerId: assignment.officerId,
    supervisorId: assignment.supervisorId,
    status: assignment.status,
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
          scheduledStartAt: assignment.shift.scheduledStartAt.toISOString(),
          scheduledEndAt: assignment.shift.scheduledEndAt.toISOString(),
        }
      : undefined,
  };
}
