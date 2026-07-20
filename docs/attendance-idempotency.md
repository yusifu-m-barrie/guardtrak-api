# Attendance Idempotency

Uses `IdempotencyRecord` via `IdempotencyService` + `PrismaIdempotencyStore`.

Scoped by `userId` + key (unique). Records also store `organisationId` and `operation`.

Operations: `attendance.clock-in`, `attendance.clock-out`, `break.start`, `break.end`.

| Outcome | Behaviour |
|---------|-----------|
| Same key + same hash | Replay prior response |
| Same key + different hash | 409 `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD` |
| In progress | 409 `IDEMPOTENCY_OPERATION_IN_PROGRESS` |

TTL: `ATTENDANCE_IDEMPOTENCY_TTL_SECONDS` (default 86400). Cleanup: expire rows where `expiresAt < now`. Do not store tokens or evidence blobs.
