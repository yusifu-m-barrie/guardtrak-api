import type { Evidence, User } from '../../../../generated/prisma/client';

type UserSummary = Pick<
  User,
  'id' | 'employeeId' | 'firstName' | 'lastName' | 'displayName' | 'avatarUrl'
>;

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

export function toEvidenceResponse(
  row: Evidence & {
    uploadedByUser?: UserSummary | null;
    verifiedByUser?: UserSummary | null;
  },
  extras?: { downloadUrl?: string | null; downloadExpiresAt?: string | null },
) {
  return {
    id: row.id,
    organisationId: row.organisationId,
    uploadedByUserId: row.uploadedByUserId,
    incidentId: row.incidentId,
    attendanceId: row.attendanceId,
    patrolVisitId: row.patrolVisitId,
    emergencyId: row.emergencyId,
    supportRequestId: row.supportRequestId,
    type: row.type,
    status: row.status,
    scanStatus: row.scanStatus,
    originalFileName: row.originalFileName,
    storageProvider: row.storageProvider,
    storageBucket: row.storageBucket,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    checksum: row.checksum,
    width: row.width,
    height: row.height,
    durationSeconds: row.durationSeconds,
    capturedAtDevice: row.capturedAtDevice?.toISOString() ?? null,
    uploadedAt: row.uploadedAt?.toISOString() ?? null,
    processedAt: row.processedAt?.toISOString() ?? null,
    verified: row.verified,
    verifiedByUserId: row.verifiedByUserId,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    thumbnailKey: row.thumbnailKey,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    uploadedByUser: mapUser(row.uploadedByUser),
    verifiedByUser: mapUser(row.verifiedByUser),
    downloadUrl: extras?.downloadUrl ?? null,
    downloadExpiresAt: extras?.downloadExpiresAt ?? null,
  };
}
