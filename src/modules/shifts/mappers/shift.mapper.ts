import type {
  Assignment,
  Client,
  SecuritySite,
  Shift,
} from '../../../../generated/prisma/client';

type SiteSummary = Pick<SecuritySite, 'id' | 'name' | 'code' | 'status'> & {
  client?: Pick<Client, 'id' | 'name' | 'status'> | null;
};

type AssignmentSummary = Pick<
  Assignment,
  'id' | 'officerId' | 'supervisorId' | 'status' | 'assignedAt' | 'confirmedAt'
>;

export function toShiftResponse(
  shift: Shift & {
    site?: SiteSummary | null;
    _count?: { assignments: number };
    assignments?: AssignmentSummary[];
  },
  options?: { includeAssignments?: boolean },
) {
  return {
    id: shift.id,
    organisationId: shift.organisationId,
    siteId: shift.siteId,
    title: shift.title,
    description: shift.description,
    scheduledStartAt: shift.scheduledStartAt.toISOString(),
    scheduledEndAt: shift.scheduledEndAt.toISOString(),
    unpaidBreakMinutes: shift.unpaidBreakMinutes,
    gracePeriodMinutes: shift.gracePeriodMinutes,
    overtimeThresholdMinutes: shift.overtimeThresholdMinutes,
    status: shift.status,
    instructions: shift.instructions,
    cancellationReason: shift.cancellationReason,
    cancelledAt: shift.cancelledAt?.toISOString() ?? null,
    cancelledByUserId: shift.cancelledByUserId,
    createdByUserId: shift.createdByUserId,
    createdAt: shift.createdAt.toISOString(),
    updatedAt: shift.updatedAt.toISOString(),
    deletedAt: shift.deletedAt?.toISOString() ?? null,
    site: shift.site
      ? {
          id: shift.site.id,
          name: shift.site.name,
          code: shift.site.code,
          status: shift.site.status,
          client: shift.site.client
            ? {
                id: shift.site.client.id,
                name: shift.site.client.name,
                status: shift.site.client.status,
              }
            : undefined,
        }
      : undefined,
    assignmentCount: shift._count?.assignments ?? shift.assignments?.length,
    assignments:
      options?.includeAssignments && shift.assignments
        ? shift.assignments.map((a: AssignmentSummary) => ({
            id: a.id,
            officerId: a.officerId,
            supervisorId: a.supervisorId,
            status: a.status,
            assignedAt: a.assignedAt.toISOString(),
            confirmedAt: a.confirmedAt?.toISOString() ?? null,
          }))
        : undefined,
  };
}
