import type {
  Incident,
  IncidentNote,
  IncidentStatusEvent,
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

export function toIncidentResponse(row: Incident) {
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
  };
}

export function toIncidentNoteResponse(row: IncidentNote) {
  return {
    id: row.id,
    incidentId: row.incidentId,
    authorUserId: row.authorUserId,
    visibility: row.visibility,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toIncidentStatusEventResponse(row: IncidentStatusEvent) {
  return {
    id: row.id,
    incidentId: row.incidentId,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    actorUserId: row.actorUserId,
    note: row.note,
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
