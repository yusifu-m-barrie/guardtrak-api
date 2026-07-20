import type {
  Client,
  PatrolCheckpoint,
  PatrolRoute,
  SecuritySite,
} from '../../../../generated/prisma/client';
import { CheckpointVerificationMethod } from '../../../../generated/prisma/client';

type SiteSummary = Pick<SecuritySite, 'id' | 'name' | 'code' | 'status'> & {
  client?: Pick<Client, 'id' | 'name' | 'status'> | null;
};

type CheckpointSummary = Pick<
  PatrolCheckpoint,
  | 'id'
  | 'name'
  | 'sequence'
  | 'verificationMethod'
  | 'requiresPhoto'
  | 'requiresNote'
  | 'active'
  | 'allowedRadiusMeters'
  | 'qrCodeHash'
>;

function qrRequired(method: CheckpointVerificationMethod): boolean {
  return (
    method === CheckpointVerificationMethod.QR_CODE ||
    method === CheckpointVerificationMethod.GPS_AND_QR
  );
}

export function toPatrolRouteResponse(
  route: PatrolRoute & {
    site?: SiteSummary | null;
    checkpoints?: CheckpointSummary[];
    _count?: { assignments: number };
  },
) {
  return {
    id: route.id,
    organisationId: route.organisationId,
    siteId: route.siteId,
    name: route.name,
    description: route.description,
    instructions: route.instructions,
    status: route.status,
    estimatedDurationMinutes: route.estimatedDurationMinutes,
    requireSequentialCompletion: route.requireSequentialCompletion,
    createdByUserId: route.createdByUserId,
    createdAt: route.createdAt.toISOString(),
    updatedAt: route.updatedAt.toISOString(),
    deletedAt: route.deletedAt?.toISOString() ?? null,
    site: route.site
      ? {
          id: route.site.id,
          name: route.site.name,
          code: route.site.code,
          status: route.site.status,
          client: route.site.client
            ? {
                id: route.site.client.id,
                name: route.site.client.name,
                status: route.site.client.status,
              }
            : undefined,
        }
      : undefined,
    checkpoints: route.checkpoints
      ?.slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((cp) => ({
        id: cp.id,
        name: cp.name,
        sequence: cp.sequence,
        verificationMethod: cp.verificationMethod,
        requiresPhoto: cp.requiresPhoto,
        requiresNote: cp.requiresNote,
        active: cp.active,
        allowedRadiusMeters: cp.allowedRadiusMeters,
        qrRequired: qrRequired(cp.verificationMethod),
      })),
    activeAssignmentCount: route._count?.assignments,
  };
}
