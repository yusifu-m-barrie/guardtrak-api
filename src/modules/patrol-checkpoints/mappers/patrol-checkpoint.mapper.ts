import type { PatrolCheckpoint } from '../../../../generated/prisma/client';
import { CheckpointVerificationMethod } from '../../../../generated/prisma/client';

function qrRequired(method: CheckpointVerificationMethod): boolean {
  return (
    method === CheckpointVerificationMethod.QR_CODE ||
    method === CheckpointVerificationMethod.GPS_AND_QR
  );
}

export function toPatrolCheckpointResponse(checkpoint: PatrolCheckpoint) {
  return {
    id: checkpoint.id,
    organisationId: checkpoint.organisationId,
    patrolRouteId: checkpoint.patrolRouteId,
    name: checkpoint.name,
    description: checkpoint.description,
    sequence: checkpoint.sequence,
    latitude: Number(checkpoint.latitude),
    longitude: Number(checkpoint.longitude),
    allowedRadiusMeters: checkpoint.allowedRadiusMeters,
    verificationMethod: checkpoint.verificationMethod,
    qrRequired: qrRequired(checkpoint.verificationMethod),
    minimumGpsAccuracyMeters: checkpoint.minimumGpsAccuracyMeters,
    requiresPhoto: checkpoint.requiresPhoto,
    requiresNote: checkpoint.requiresNote,
    instructions: checkpoint.instructions,
    active: checkpoint.active,
    createdAt: checkpoint.createdAt.toISOString(),
    updatedAt: checkpoint.updatedAt.toISOString(),
    deletedAt: checkpoint.deletedAt?.toISOString() ?? null,
  };
}
