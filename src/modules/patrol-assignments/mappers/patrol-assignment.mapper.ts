import type {
  PatrolAssignment,
  PatrolAssignmentCheckpoint,
  PatrolRoute,
  PatrolVisit,
  SecuritySite,
} from '../../../../generated/prisma/client';
import { CheckpointVerificationMethod } from '../../../../generated/prisma/client';
import type { PatrolProgressResult } from '../../patrols/patrol-progress.service';

function qrRequired(method: CheckpointVerificationMethod): boolean {
  return (
    method === CheckpointVerificationMethod.QR_CODE ||
    method === CheckpointVerificationMethod.GPS_AND_QR
  );
}

export function toSnapshotResponse(snap: PatrolAssignmentCheckpoint) {
  return {
    id: snap.id,
    sourceCheckpointId: snap.sourceCheckpointId,
    name: snap.name,
    description: snap.description,
    sequence: snap.sequence,
    latitude: Number(snap.latitude),
    longitude: Number(snap.longitude),
    allowedRadiusMeters: snap.allowedRadiusMeters,
    verificationMethod: snap.verificationMethod,
    qrRequired: qrRequired(snap.verificationMethod),
    requiresPhoto: snap.requiresPhoto,
    requiresNote: snap.requiresNote,
    instructions: snap.instructions,
    minimumGpsAccuracyMeters: snap.minimumGpsAccuracyMeters,
    createdAt: snap.createdAt.toISOString(),
  };
}

export function toPatrolAssignmentResponse(
  assignment: PatrolAssignment & {
    patrolRoute?: Pick<
      PatrolRoute,
      'id' | 'name' | 'status' | 'requireSequentialCompletion'
    > | null;
    site?: Pick<SecuritySite, 'id' | 'name' | 'code' | 'status'> | null;
    checkpointSnapshots?: PatrolAssignmentCheckpoint[];
    visits?: Pick<
      PatrolVisit,
      'id' | 'assignmentCheckpointId' | 'status' | 'patrolCheckpointId'
    >[];
  },
  progress?: PatrolProgressResult | null,
) {
  const snapshots = assignment.checkpointSnapshots
    ?.slice()
    .sort((a, b) => a.sequence - b.sequence);

  return {
    id: assignment.id,
    organisationId: assignment.organisationId,
    patrolRouteId: assignment.patrolRouteId,
    assignmentId: assignment.assignmentId,
    officerId: assignment.officerId,
    shiftId: assignment.shiftId,
    siteId: assignment.siteId,
    scheduledStartAt: assignment.scheduledStartAt?.toISOString() ?? null,
    scheduledEndAt: assignment.scheduledEndAt?.toISOString() ?? null,
    startedAt: assignment.startedAt?.toISOString() ?? null,
    startedAtDevice: assignment.startedAtDevice?.toISOString() ?? null,
    completedAt: assignment.completedAt?.toISOString() ?? null,
    completedAtDevice: assignment.completedAtDevice?.toISOString() ?? null,
    status: assignment.status,
    completedCheckpointCount: assignment.completedCheckpointCount,
    totalCheckpointCount: assignment.totalCheckpointCount,
    finalNote: assignment.finalNote,
    cancellationReason: assignment.cancellationReason,
    cancelledAt: assignment.cancelledAt?.toISOString() ?? null,
    cancelledByUserId: assignment.cancelledByUserId,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
    route: assignment.patrolRoute
      ? {
          id: assignment.patrolRoute.id,
          name: assignment.patrolRoute.name,
          status: assignment.patrolRoute.status,
          requireSequentialCompletion:
            assignment.patrolRoute.requireSequentialCompletion,
        }
      : undefined,
    site: assignment.site
      ? {
          id: assignment.site.id,
          name: assignment.site.name,
          code: assignment.site.code,
          status: assignment.site.status,
        }
      : undefined,
    checkpoints: snapshots?.map((s) => toSnapshotResponse(s)),
    progress: progress
      ? {
          totalCheckpoints: progress.totalCheckpoints,
          completedCheckpoints: progress.completedCheckpoints,
          pendingCheckpoints: progress.pendingCheckpoints,
          missedCheckpoints: progress.missedCheckpoints,
          skippedCheckpoints: progress.skippedCheckpoints,
          reviewRequiredCheckpoints: progress.reviewRequiredCheckpoints,
          completionPercentage: progress.completionPercentage,
          nextCheckpointId: progress.nextCheckpoint?.id ?? null,
          allRequiredComplete: progress.allRequiredComplete,
        }
      : undefined,
  };
}
