import type {
  PatrolAssignment,
  PatrolAssignmentCheckpoint,
  PatrolVisit,
} from '../../../../generated/prisma/client';
import { CheckpointVerificationMethod } from '../../../../generated/prisma/client';

function qrRequired(method: CheckpointVerificationMethod): boolean {
  return (
    method === CheckpointVerificationMethod.QR_CODE ||
    method === CheckpointVerificationMethod.GPS_AND_QR
  );
}

export function toPatrolVisitResponse(
  visit: PatrolVisit & {
    assignmentCheckpoint?: PatrolAssignmentCheckpoint | null;
    patrolAssignment?: Pick<
      PatrolAssignment,
      'id' | 'status' | 'patrolRouteId' | 'officerId'
    > | null;
  },
) {
  return {
    id: visit.id,
    organisationId: visit.organisationId,
    patrolAssignmentId: visit.patrolAssignmentId,
    patrolCheckpointId: visit.patrolCheckpointId,
    assignmentCheckpointId: visit.assignmentCheckpointId,
    officerId: visit.officerId,
    shiftId: visit.shiftId,
    siteId: visit.siteId,
    status: visit.status,
    verificationMethod: visit.verificationMethod,
    visitedAtDevice: visit.visitedAtDevice.toISOString(),
    visitedAtServer: visit.visitedAtServer?.toISOString() ?? null,
    latitude: Number(visit.latitude),
    longitude: Number(visit.longitude),
    accuracyMeters:
      visit.accuracyMeters !== null ? Number(visit.accuracyMeters) : null,
    distanceMeters:
      visit.distanceMeters !== null ? Number(visit.distanceMeters) : null,
    note: visit.note,
    evidenceId: visit.evidenceId,
    localVisitId: visit.localVisitId,
    reviewedAt: visit.reviewedAt?.toISOString() ?? null,
    reviewedByUserId: visit.reviewedByUserId,
    reviewReason: visit.reviewReason,
    createdAt: visit.createdAt.toISOString(),
    updatedAt: visit.updatedAt.toISOString(),
    checkpoint: visit.assignmentCheckpoint
      ? {
          id: visit.assignmentCheckpoint.id,
          sourceCheckpointId: visit.assignmentCheckpoint.sourceCheckpointId,
          name: visit.assignmentCheckpoint.name,
          sequence: visit.assignmentCheckpoint.sequence,
          verificationMethod: visit.assignmentCheckpoint.verificationMethod,
          qrRequired: qrRequired(visit.assignmentCheckpoint.verificationMethod),
        }
      : undefined,
    patrolAssignment: visit.patrolAssignment
      ? {
          id: visit.patrolAssignment.id,
          status: visit.patrolAssignment.status,
          patrolRouteId: visit.patrolAssignment.patrolRouteId,
          officerId: visit.patrolAssignment.officerId,
        }
      : undefined,
  };
}
