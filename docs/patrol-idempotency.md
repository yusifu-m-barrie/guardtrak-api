# Patrol Idempotency

Uses `IdempotencyRecord` via `IdempotencyService` + `PrismaIdempotencyStore`.

Scoped by `userId` + key (unique). Records also store `organisationId` and `operation`.

## Operations

| Operation | Endpoint |
|-----------|----------|
| `patrol.start` | `POST /patrol-assignments/:id/start` |
| `patrol.visit` | `POST .../checkpoints/:checkpointId/visit` |
| `patrol.complete` | `POST /patrol-assignments/:id/complete` |

| Outcome | Behaviour |
|---------|-----------|
| Same key + same hash | Replay prior response body |
| Same key + different hash | 409 `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD` |
| In progress | 409 `IDEMPOTENCY_OPERATION_IN_PROGRESS` |

TTL: `PATROL_IDEMPOTENCY_TTL_SECONDS` (default 86400).

## Hash safety

Visit request hashes include `hasQr: boolean` and never the raw QR string. Do not store tokens, evidence blobs, or QR secrets in idempotency `responseBody` beyond the normal API mapper output (which already omits QR secrets).
