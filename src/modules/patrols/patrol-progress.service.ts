import { Injectable } from '@nestjs/common';
import {
  CheckpointStatus,
  type PatrolAssignmentCheckpoint,
  type PatrolVisit,
} from '../../../generated/prisma/client';

export interface PatrolProgressResult {
  totalCheckpoints: number;
  completedCheckpoints: number;
  pendingCheckpoints: number;
  missedCheckpoints: number;
  skippedCheckpoints: number;
  reviewRequiredCheckpoints: number;
  completionPercentage: number;
  nextCheckpoint: PatrolAssignmentCheckpoint | null;
  allRequiredComplete: boolean;
}

@Injectable()
export class PatrolProgressService {
  calculate(
    snapshots: PatrolAssignmentCheckpoint[],
    visits: Pick<
      PatrolVisit,
      'assignmentCheckpointId' | 'status' | 'patrolCheckpointId'
    >[],
  ): PatrolProgressResult {
    const ordered = [...snapshots].sort((a, b) => a.sequence - b.sequence);
    const visitBySnap = new Map(
      visits
        .filter((v) => v.assignmentCheckpointId)
        .map((v) => [v.assignmentCheckpointId!, v.status]),
    );

    let completed = 0;
    let missed = 0;
    let skipped = 0;
    let review = 0;
    let next: PatrolAssignmentCheckpoint | null = null;

    for (const snap of ordered) {
      const status = visitBySnap.get(snap.id);
      if (status === CheckpointStatus.COMPLETED) {
        completed += 1;
        continue;
      }
      if (status === CheckpointStatus.MISSED) {
        missed += 1;
        continue;
      }
      if (status === CheckpointStatus.SKIPPED) {
        skipped += 1;
        continue;
      }
      if (
        status === CheckpointStatus.REQUIRES_REVIEW ||
        status === CheckpointStatus.OUTSIDE_GEOFENCE
      ) {
        review += 1;
        if (!next) {
          next = snap;
        }
        continue;
      }
      if (!next) {
        next = snap;
      }
    }

    const total = ordered.length;
    const pending = Math.max(0, total - completed - missed - skipped);
    const completionPercentage =
      total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100));

    return {
      totalCheckpoints: total,
      completedCheckpoints: completed,
      pendingCheckpoints: pending,
      missedCheckpoints: missed,
      skippedCheckpoints: skipped,
      reviewRequiredCheckpoints: review,
      completionPercentage,
      nextCheckpoint: next,
      allRequiredComplete: total > 0 && completed === total,
    };
  }
}
