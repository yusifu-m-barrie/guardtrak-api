# Offline Sync Notes (Phase 7)

- Clients buffer mutations with stable `operationId` + `localEntityId`.
- `POST /sync/batch` replays supported creates using the same idempotency key semantics as online APIs.
- Conflicts (`IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`) become `SyncConflict` rows with reason codes.
- Attendance clock and patrol visit should still call their dedicated endpoints with `idempotencyKey` for full validation (geofence, QR, etc.); batch lists them as unsupported for safety.
- Phase 8 may expand batch coverage and push acknowledgement.
