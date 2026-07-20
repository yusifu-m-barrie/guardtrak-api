# Idempotency

Offline-capable officer devices may retry mutations. Idempotency is a **server concern**, never client-only.

## Phase 1 Status

Foundation only:

- `Idempotency-Key` header decorator
- Idempotency service interface and types
- Conflict exception
- Persistence port (`IdempotencyStore`) — **not implemented yet**

## Future Operations Requiring Idempotency

- Clock-in
- Clock-out
- Start break
- End break
- Complete patrol checkpoint
- Create incident
- Complete evidence upload
- Send SOS
- Offline profile update (where enabled)

## Expected Behaviour (Later Phases)

1. Client sends `Idempotency-Key` on mutating requests.
2. Server stores key + request hash + outcome.
3. Retries with the same key and payload replay the stored response.
4. Same key with a different payload returns `IDEMPOTENCY_CONFLICT`.
5. In-progress duplicate requests return conflict until completion.
