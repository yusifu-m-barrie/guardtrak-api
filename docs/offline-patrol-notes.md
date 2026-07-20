# Offline Patrol Notes

Phase 6 prepares mobile offline retries without implementing sync-batch.

## Client should send

- `deviceTimestamp` (audit only; server time is authoritative for `startedAt` / `visitedAtServer` / `completedAt`)
- `localVisitId` for visit reconciliation
- Stable `idempotencyKey` across retries (`patrol.start` / `patrol.visit` / `patrol.complete`)
- JWT device context from login (`deviceId` must remain ACTIVE)

## Server behaviour

- Reject device timestamps outside `PATROL_DEVICE_TIME_TOLERANCE_MINUTES` → `PATROL_VISIT_DEVICE_TIME_INVALID`
- If skew exceeds `PATROL_OFFLINE_REVIEW_THRESHOLD_MINUTES` after passing tolerance checks, visits may be marked `REQUIRES_REVIEW` (tolerance is usually tighter, so this path is for future wider offline windows)
- Never trust client-computed distance or completion percentage
- Sequential enforcement and QR hashing remain server-authoritative on retry
- Safe retries via [patrol-idempotency.md](./patrol-idempotency.md)

## Env vars

| Variable | Default | Role |
|----------|---------|------|
| `PATROL_DEVICE_TIME_TOLERANCE_MINUTES` | 10 | Max \|device − server\| skew |
| `PATROL_OFFLINE_REVIEW_THRESHOLD_MINUTES` | 30 | Soft review threshold |
| `PATROL_START_EARLY_MINUTES` | 15 | Start window before schedule |
| `PATROL_START_LATE_MINUTES` | 30 | Start window after schedule/end |
| `PATROL_MAX_CHECKPOINT_RADIUS_METERS` | 1000 | Max checkpoint radius |
| `PATROL_REQUIRE_SEQUENTIAL_CHECKPOINTS` | true | Default for new routes |
| `PATROL_IDEMPOTENCY_TTL_SECONDS` | 86400 | Idempotency TTL |

Full sync-batch and conflict resolution: Phase 9.
