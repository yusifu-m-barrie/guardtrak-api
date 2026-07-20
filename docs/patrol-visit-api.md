# Patrol Visit API

## Endpoints

| Method | Path | Permission |
|--------|------|------------|
| POST | `/patrol-assignments/:patrolAssignmentId/checkpoints/:checkpointId/visit` | `patrol-visit:create:self` |
| GET | `/patrol-visits/me` | `patrol-visit:read:self` |
| GET | `/patrol-visits` | `patrol-visit:read` |
| GET | `/patrol-visits/:id` | self / supervisor / admin (service) |
| POST | `/patrol-visits/:id/approve` | `patrol-visit:review` |
| POST | `/patrol-visits/:id/reject` | `patrol-visit:review` |
| POST | `/patrol-visits/:id/override` | `patrol-visit:override` |

`checkpointId` may be the snapshot id **or** `sourceCheckpointId` (resolved to the assignment snapshot).

## Visit rules

- Patrol must be `IN_PROGRESS`; officer must own it
- ACTIVE device; device time within `PATROL_DEVICE_TIME_TOLERANCE_MINUTES`
- Submitted `verificationMethod` must match snapshot method (no client downgrade)
- Officers cannot submit `MANUAL_SUPERVISOR_OVERRIDE`
- When `route.requireSequentialCompletion` is true, only the next pending snapshot is allowed → else `PATROL_CHECKPOINT_OUT_OF_ORDER`
- Duplicate completed/skipped visit → `PATROL_CHECKPOINT_ALREADY_COMPLETED`
- Idempotent operation `patrol.visit` (request hash uses `hasQr` boolean, never raw QR)

## Verification outcomes (as implemented)

| Method | Behaviour |
|--------|-----------|
| `GPS` | Must be inside `allowedRadiusMeters`; accuracy ≤ minimum |
| `QR_CODE` | QR must verify against snapshot hash; GPS captured for audit |
| `GPS_AND_QR` | Both geofence and QR must pass |
| Outside radius (GPS methods) | Reject — `PATROL_VISIT_OUTSIDE_GEOFENCE` (no completed visit) |
| Invalid QR | Reject — `PATROL_VISIT_QR_INVALID` |
| Missing photo/note when required | Reject |

Success → `COMPLETED` (or `REQUIRES_REVIEW` if offline threshold exceeded — see [offline-patrol-notes.md](./offline-patrol-notes.md)).

## Review

Approve → `COMPLETED`; reject → `MISSED`; override may set `COMPLETED` / `SKIPPED` / `MISSED` and stamps `MANUAL_SUPERVISOR_OVERRIDE`. Progress counters recalculated transactionally.

See also: [patrol-verification.md](./patrol-verification.md), [patrol-qr-security.md](./patrol-qr-security.md)
