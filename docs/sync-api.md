# Sync Batch API (Phase 7)

`POST /api/v1/sync/batch` — permission `sync:submit:self`.

Body:

```json
{
  "operations": [
    {
      "operationId": "uuid",
      "operationType": "create",
      "entityType": "incident.create",
      "payload": {},
      "clientTimestamp": "ISO",
      "localEntityId": "optional"
    }
  ]
}
```

Supported entity types: `incident.create`, `emergency.sos`, `support.request`.  
`attendance.clock_in|out` and `patrol.visit` return not-implemented (use dedicated endpoints).  
Idempotent replay via `IdempotencyService`; payload mismatches write `SyncConflict` rows.
