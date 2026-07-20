import type { Emergency } from '../../../../generated/prisma/client';
import { toApiEmergencyStatus } from '../emergency-transitions.util';

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

export function toEmergencyResponse(row: Emergency) {
  return {
    id: row.id,
    organisationId: row.organisationId,
    emergencyNumber: row.emergencyNumber,
    officerId: row.officerId,
    userId: row.userId,
    assignmentId: row.assignmentId,
    shiftId: row.shiftId,
    siteId: row.siteId,
    deviceId: row.deviceId,
    status: toApiEmergencyStatus(row.status),
    dbStatus: row.status,
    latitude: decimalToNumber(row.latitude) ?? 0,
    longitude: decimalToNumber(row.longitude) ?? 0,
    accuracyMeters: decimalToNumber(row.accuracyMeters),
    deviceCreatedAt: row.deviceCreatedAt.toISOString(),
    serverCreatedAt: row.serverCreatedAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    acknowledgedByUserId: row.acknowledgedByUserId,
    respondingAt: row.respondingAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedByUserId: row.resolvedByUserId,
    cancellationReason: row.cancellationReason,
    resolutionNotes: row.resolutionNotes,
    localEmergencyId: row.localEmergencyId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
