# Patrol Assignment API

Base path: `/api/v1/patrol-assignments`

## Endpoints

| Method | Path | Permission |
|--------|------|------------|
| POST | `/patrol-assignments` | `patrol-assignment:create` |
| POST | `/patrol-assignments/batch` | `patrol-assignment:create` |
| GET | `/patrol-assignments` | `patrol-assignment:read` |
| GET | `/patrol-assignments/current` | `patrol-assignment:read:self` |
| GET | `/patrol-assignments/upcoming` | `patrol-assignment:read:self` |
| GET | `/patrol-assignments/:id` | self / supervisor / admin (service) |
| POST | `/patrol-assignments/:id/start` | `patrol-assignment:read:self` |
| POST | `/patrol-assignments/:id/complete` | `patrol-assignment:read:self` |
| POST | `/patrol-assignments/:id/cancel` | `patrol-assignment:cancel` |
| POST | `/patrol-assignments/:id/mark-missed` | `patrol-assignment:review` |

## Snapshot policy (Option A)

On create, the service copies active route checkpoints into immutable `PatrolAssignmentCheckpoint` rows (including `qrCodeHash`, method, coords, sequence). Later route edits do not mutate in-flight patrols. Visits reference `assignmentCheckpointId`.

## Create rules

- Route must be `ACTIVE`
- Shift assignment status in `ASSIGNED` | `CONFIRMED` | `IN_PROGRESS`
- Officer ACTIVE; route site must match shift site → else `PATROL_ASSIGNMENT_SITE_MISMATCH`
- No duplicate active patrol for same route + shift assignment → `PATROL_ASSIGNMENT_DUPLICATE`
- Sets `totalCheckpointCount`; creates `PatrolAssignmentEvent` (`NOT_STARTED`)

## Start

Requires: officer owns patrol, status `NOT_STARTED`, active attendance on the shift assignment, ACTIVE device, device timestamp within `PATROL_DEVICE_TIME_TOLERANCE_MINUTES`, scheduled window (`PATROL_START_EARLY_MINUTES` / `PATROL_START_LATE_MINUTES` when scheduled). Idempotent operation `patrol.start`.

## Complete

Recalculates progress from snapshots + visits (does not trust counters alone).

- All checkpoints completed → `COMPLETED`
- Some completed + `finalNote` → `PARTIALLY_COMPLETED`
- None completed → `PATROL_ASSIGNMENT_NOT_COMPLETE`
- Idempotent operation `patrol.complete`

## Cancel / mark-missed

- Cancel: reason required; `NOT_STARTED` / `IN_PROGRESS` → `CANCELLED`; visits preserved
- Mark-missed: overdue manual mark; `MISSED` or `PARTIALLY_COMPLETED` when progress exists

See also: [patrol-progress.md](./patrol-progress.md), [patrol-idempotency.md](./patrol-idempotency.md)
