import type {
  OfficerProfile,
  PatrolAssignment,
  PatrolAssignmentCheckpoint,
  PatrolRoute,
  PatrolVisit,
  SecuritySite,
  Shift,
  User,
} from '../../../../generated/prisma/client';
import { CheckpointVerificationMethod } from '../../../../generated/prisma/client';
import type { PatrolProgressResult } from '../../patrols/patrol-progress.service';

function qrRequired(method: CheckpointVerificationMethod): boolean {
  return (
    method === CheckpointVerificationMethod.QR_CODE ||
    method === CheckpointVerificationMethod.GPS_AND_QR
  );
}

function decimalToNumber(
  value: { toString(): string } | number | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return Number(value);
}

type OfficerWithUser = Pick<
  OfficerProfile,
  'id' | 'officerNumber' | 'employmentStatus'
> & {
  user?: Pick<
    User,
    'id' | 'employeeId' | 'firstName' | 'lastName' | 'displayName' | 'avatarUrl'
  > | null;
};

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
    officer?: OfficerWithUser | null;
    shift?: Pick<
      Shift,
      'id' | 'title' | 'status' | 'scheduledStartAt' | 'scheduledEndAt'
    > | null;
    checkpointSnapshots?: PatrolAssignmentCheckpoint[];
    visits?: (Pick<
      PatrolVisit,
      | 'id'
      | 'assignmentCheckpointId'
      | 'status'
      | 'patrolCheckpointId'
      | 'visitedAtServer'
      | 'latitude'
      | 'longitude'
    > & {})[];
    events?: {
      actorUserId: string | null;
      createdAt: Date;
      actorUser?: Pick<
        User,
        | 'id'
        | 'firstName'
        | 'lastName'
        | 'displayName'
        | 'employeeId'
        | 'role'
      > | null;
    }[];
  },
  progress?: PatrolProgressResult | null,
) {
  const snapshots = assignment.checkpointSnapshots
    ?.slice()
    .sort((a, b) => a.sequence - b.sequence);

  const latestVisit = [...(assignment.visits ?? [])]
    .filter((v) => v.visitedAtServer)
    .sort(
      (a, b) =>
        new Date(b.visitedAtServer!).getTime() -
        new Date(a.visitedAtServer!).getTime(),
    )[0];

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
    createdBy: (() => {
      const createEvent = assignment.events?.[0];
      const actor = createEvent?.actorUser;
      if (!actor) return undefined;
      return {
        id: actor.id,
        firstName: actor.firstName,
        lastName: actor.lastName,
        displayName: actor.displayName,
        employeeId: actor.employeeId,
        role: actor.role,
      };
    })(),
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
    officer: assignment.officer
      ? {
          id: assignment.officer.id,
          officerNumber: assignment.officer.officerNumber,
          employmentStatus: assignment.officer.employmentStatus,
          user: assignment.officer.user
            ? {
                id: assignment.officer.user.id,
                employeeId: assignment.officer.user.employeeId,
                firstName: assignment.officer.user.firstName,
                lastName: assignment.officer.user.lastName,
                displayName: assignment.officer.user.displayName,
                avatarUrl: assignment.officer.user.avatarUrl,
              }
            : null,
        }
      : undefined,
    shift: assignment.shift
      ? {
          id: assignment.shift.id,
          title: assignment.shift.title,
          status: assignment.shift.status,
          scheduledStartAt: assignment.shift.scheduledStartAt.toISOString(),
          scheduledEndAt: assignment.shift.scheduledEndAt.toISOString(),
        }
      : undefined,
    checkpoints: snapshots?.map((s) => toSnapshotResponse(s)),
    visits: assignment.visits?.map((visit) => ({
      id: visit.id,
      assignmentCheckpointId: visit.assignmentCheckpointId,
      patrolCheckpointId: visit.patrolCheckpointId,
      status: visit.status,
      visitedAtServer: visit.visitedAtServer?.toISOString() ?? null,
      latitude: decimalToNumber(visit.latitude),
      longitude: decimalToNumber(visit.longitude),
    })),
    currentLocation:
      latestVisit?.latitude != null && latestVisit.longitude != null
        ? {
            latitude: Number(latestVisit.latitude),
            longitude: Number(latestVisit.longitude),
            at: latestVisit.visitedAtServer?.toISOString() ?? null,
          }
        : null,
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
          nextCheckpointName: progress.nextCheckpoint?.name ?? null,
          nextCheckpointSequence: progress.nextCheckpoint?.sequence ?? null,
          allRequiredComplete: progress.allRequiredComplete,
          sequentialViolation: progress.skippedCheckpoints > 0,
        }
      : undefined,
  };
}
