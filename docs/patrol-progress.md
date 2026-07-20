# Patrol Progress

Authoritative calculator: `PatrolProgressService.calculate(snapshots, visits)`.

## Inputs

- Immutable `PatrolAssignmentCheckpoint` snapshots (ordered by `sequence`)
- Visit statuses keyed by `assignmentCheckpointId`

## Outputs

| Field | Meaning |
|-------|---------|
| `totalCheckpoints` | Snapshot count |
| `completedCheckpoints` | Visits with `COMPLETED` |
| `missedCheckpoints` / `skippedCheckpoints` | Matching visit statuses |
| `reviewRequiredCheckpoints` | `REQUIRES_REVIEW` or `OUTSIDE_GEOFENCE` |
| `pendingCheckpoints` | Remainder not completed/missed/skipped |
| `completionPercentage` | Round(`completed/total * 100`), 0 when empty |
| `nextCheckpoint` | First incomplete/non-terminal snapshot |
| `allRequiredComplete` | `completed === total` and total > 0 |

## Usage

- Embedded in patrol assignment responses as `progress`
- Recalculated on visit create/review and on complete/mark-missed
- Stored counters (`completedCheckpointCount`, `totalCheckpointCount`) are synchronized but not trusted alone for completion decisions

Unit coverage: `patrol-progress.service.spec.ts`
