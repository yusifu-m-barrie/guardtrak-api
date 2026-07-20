# Patrol Checkpoint API

## Endpoints

| Method | Path | Permission |
|--------|------|------------|
| POST | `/patrol-routes/:routeId/checkpoints` | `patrol-checkpoint:create` |
| POST | `/patrol-routes/:routeId/checkpoints/batch` | `patrol-checkpoint:create` |
| GET | `/patrol-routes/:routeId/checkpoints` | `patrol-checkpoint:read` |
| POST | `/patrol-routes/:routeId/checkpoints/reorder` | `patrol-checkpoint:reorder` |
| GET | `/patrol-checkpoints/:id` | `patrol-checkpoint:read` |
| PATCH | `/patrol-checkpoints/:id` | `patrol-checkpoint:update` |
| DELETE | `/patrol-checkpoints/:id` | `patrol-checkpoint:archive` → 204 |

## Create rules

- Sequence unique per route → `PATROL_CHECKPOINT_SEQUENCE_CONFLICT`
- Coordinates validated via `GeofenceService`
- Radius within `PATROL_MAX_CHECKPOINT_RADIUS_METERS` (default 1000)
- `QR_CODE` / `GPS_AND_QR` require `qrCodeValue`; hashed with SHA-256 of trim+uppercase before storage
- QR hash unique org-wide → `PATROL_CHECKPOINT_QR_CONFLICT`
- `MANUAL_SUPERVISOR_OVERRIDE` cannot be configured on checkpoints
- Responses: `qrRequired` boolean only — never `qrCodeValue` / `qrCodeHash`

## Batch

All-or-nothing transaction. Rejects duplicate sequences or QR values inside the request.

## Reorder

Request body: `{ checkpoints: [{ checkpointId, sequence }] }`

- Must include every active checkpoint on the route
- Contiguous sequences from 1
- Two-step sequence update (temp negatives, then final) to avoid unique conflicts

## Archive / update guards

Soft archive sets `active=false` + `deletedAt`. Structural changes (sequence, coords, method, QR) rejected while referenced by active assignment snapshots (`PATROL_CHECKPOINT_IN_USE`).

See also: [patrol-qr-security.md](./patrol-qr-security.md)
