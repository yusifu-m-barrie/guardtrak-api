import type {
  Assignment,
  Client,
  Incident,
  IncidentNote,
  IncidentStatusEvent,
  OfficerProfile,
  PatrolAssignment,
  PatrolRoute,
  Prisma,
  SecuritySite,
  Shift,
  User,
} from '../../../../generated/prisma/client';

function decimalToNumber(
  value: { toNumber(): number } | number | null | undefined,
): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  return value.toNumber();
}

type UserSummary = Pick<
  User,
  'id' | 'employeeId' | 'firstName' | 'lastName' | 'displayName' | 'avatarUrl'
>;

type OfficerWithUser = Pick<
  OfficerProfile,
  'id' | 'officerNumber' | 'employmentStatus'
> & {
  user?: UserSummary | null;
};

export const INCIDENT_INCLUDE = {
  site: {
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      latitude: true,
      longitude: true,
    },
  },
  client: {
    select: { id: true, name: true, status: true },
  },
  reportedByOfficer: {
    select: {
      id: true,
      officerNumber: true,
      employmentStatus: true,
      user: {
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  },
  assignedSupervisor: {
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      displayName: true,
      avatarUrl: true,
    },
  },
  shift: {
    select: {
      id: true,
      title: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
    },
  },
  assignment: {
    select: {
      id: true,
      status: true,
      officerId: true,
      supervisorId: true,
    },
  },
  patrolAssignment: {
    select: {
      id: true,
      status: true,
      patrolRouteId: true,
      patrolRoute: {
        select: { id: true, name: true, status: true },
      },
    },
  },
} satisfies Prisma.IncidentInclude;

function mapUser(user: UserSummary | null | undefined) {
  if (!user) return null;
  return {
    id: user.id,
    employeeId: user.employeeId,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

export function toIncidentResponse(
  row: Incident & {
    site?: Pick<
      SecuritySite,
      'id' | 'name' | 'code' | 'status' | 'latitude' | 'longitude'
    > | null;
    client?: Pick<Client, 'id' | 'name' | 'status'> | null;
    reportedByOfficer?: OfficerWithUser | null;
    assignedSupervisor?: UserSummary | null;
    shift?: Pick<
      Shift,
      'id' | 'title' | 'status' | 'scheduledStartAt' | 'scheduledEndAt'
    > | null;
    assignment?: Pick<
      Assignment,
      'id' | 'status' | 'officerId' | 'supervisorId'
    > | null;
    patrolAssignment?:
      | (Pick<PatrolAssignment, 'id' | 'status' | 'patrolRouteId'> & {
          patrolRoute?: Pick<PatrolRoute, 'id' | 'name' | 'status'> | null;
        })
      | null;
  },
) {
  return {
    id: row.id,
    organisationId: row.organisationId,
    incidentNumber: row.incidentNumber,
    clientId: row.clientId,
    siteId: row.siteId,
    shiftId: row.shiftId,
    assignmentId: row.assignmentId,
    patrolAssignmentId: row.patrolAssignmentId,
    reportedByOfficerId: row.reportedByOfficerId,
    reportedByUserId: row.reportedByUserId,
    category: row.category,
    severity: row.severity,
    priority: row.priority,
    status: row.status,
    title: row.title,
    description: row.description,
    actionsTaken: row.actionsTaken,
    occurredAtDevice: row.occurredAtDevice.toISOString(),
    occurredAtServer: row.occurredAtServer?.toISOString() ?? null,
    reportedAtServer: row.reportedAtServer.toISOString(),
    latitude: decimalToNumber(row.latitude),
    longitude: decimalToNumber(row.longitude),
    accuracyMeters: decimalToNumber(row.accuracyMeters),
    peopleInvolved: row.peopleInvolved,
    witnesses: row.witnesses,
    weatherNotes: row.weatherNotes,
    emergencyServicesContacted: row.emergencyServicesContacted,
    emergencyServiceDetails: row.emergencyServiceDetails,
    requiresImmediateNotification: row.requiresImmediateNotification,
    escalationReason: row.escalationReason,
    escalationTriggeredAt: row.escalationTriggeredAt?.toISOString() ?? null,
    assignedSupervisorId: row.assignedSupervisorId,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    dispatchedAt: row.dispatchedAt?.toISOString() ?? null,
    investigationStartedAt: row.investigationStartedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    resolutionSummary: row.resolutionSummary,
    localIncidentId: row.localIncidentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    site: row.site
      ? {
          id: row.site.id,
          name: row.site.name,
          code: row.site.code,
          status: row.site.status,
          latitude: decimalToNumber(row.site.latitude),
          longitude: decimalToNumber(row.site.longitude),
        }
      : undefined,
    client: row.client
      ? {
          id: row.client.id,
          name: row.client.name,
          status: row.client.status,
        }
      : undefined,
    officer: row.reportedByOfficer
      ? {
          id: row.reportedByOfficer.id,
          officerNumber: row.reportedByOfficer.officerNumber,
          employmentStatus: row.reportedByOfficer.employmentStatus,
          user: mapUser(row.reportedByOfficer.user),
        }
      : undefined,
    assignedSupervisor: mapUser(row.assignedSupervisor),
    shift: row.shift
      ? {
          id: row.shift.id,
          title: row.shift.title,
          status: row.shift.status,
          scheduledStartAt: row.shift.scheduledStartAt.toISOString(),
          scheduledEndAt: row.shift.scheduledEndAt.toISOString(),
        }
      : undefined,
    assignment: row.assignment
      ? {
          id: row.assignment.id,
          status: row.assignment.status,
          officerId: row.assignment.officerId,
          supervisorId: row.assignment.supervisorId,
        }
      : undefined,
    relatedPatrol: row.patrolAssignment
      ? {
          id: row.patrolAssignment.id,
          status: row.patrolAssignment.status,
          patrolRouteId: row.patrolAssignment.patrolRouteId,
          route: row.patrolAssignment.patrolRoute
            ? {
                id: row.patrolAssignment.patrolRoute.id,
                name: row.patrolAssignment.patrolRoute.name,
                status: row.patrolAssignment.patrolRoute.status,
              }
            : null,
        }
      : undefined,
  };
}

export function toIncidentNoteResponse(
  row: IncidentNote & { authorUser?: UserSummary | null },
) {
  return {
    id: row.id,
    incidentId: row.incidentId,
    authorUserId: row.authorUserId,
    visibility: row.visibility,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    authorUser: mapUser(row.authorUser),
  };
}

export function toIncidentStatusEventResponse(
  row: IncidentStatusEvent & { actorUser?: UserSummary | null },
) {
  return {
    id: row.id,
    incidentId: row.incidentId,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    actorUserId: row.actorUserId,
    note: row.note,
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    actorUser: mapUser(row.actorUser),
  };
}
