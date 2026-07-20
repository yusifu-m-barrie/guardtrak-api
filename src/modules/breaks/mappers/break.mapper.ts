import type { ShiftBreak } from '../../../../generated/prisma/client';

export function toBreakResponse(breakRow: ShiftBreak) {
  return {
    id: breakRow.id,
    organisationId: breakRow.organisationId,
    attendanceId: breakRow.attendanceId,
    officerId: breakRow.officerId,
    shiftId: breakRow.shiftId,
    type: breakRow.type,
    status: breakRow.status,
    startedAtDevice: breakRow.startedAtDevice.toISOString(),
    startedAtServer: breakRow.startedAtServer?.toISOString() ?? null,
    endedAtDevice: breakRow.endedAtDevice?.toISOString() ?? null,
    endedAtServer: breakRow.endedAtServer?.toISOString() ?? null,
    durationMinutes: breakRow.durationMinutes,
    note: breakRow.note,
    localBreakId: breakRow.localBreakId,
    cancellationReason: breakRow.cancellationReason,
    cancelledByUserId: breakRow.cancelledByUserId,
    createdAt: breakRow.createdAt.toISOString(),
    updatedAt: breakRow.updatedAt.toISOString(),
  };
}
