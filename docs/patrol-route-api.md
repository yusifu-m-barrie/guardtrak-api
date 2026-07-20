# Patrol Route API

Base path: `/api/v1/patrol-routes`

## Endpoints

| Method | Path | Permission |
|--------|------|------------|
| POST | `/patrol-routes` | `patrol-route:create` |
| GET | `/patrol-routes` | `patrol-route:read` |
| GET | `/patrol-routes/:id` | `patrol-route:read` |
| PATCH | `/patrol-routes/:id` | `patrol-route:update` |
| PATCH | `/patrol-routes/:id/status` | `patrol-route:activate` |
| DELETE | `/patrol-routes/:id` | `patrol-route:archive` → 204 soft archive |

## Create rules

- `organisationId` from JWT
- Site must be ACTIVE in the same organisation
- Name normalized; duplicate active name at same site → `PATROL_ROUTE_NAME_CONFLICT`
- Initial status `DRAFT`
- `requireSequentialCompletion` defaults from `PATROL_REQUIRE_SEQUENTIAL_CHECKPOINTS` (default `true`)
- Nested checkpoint summaries return `qrRequired` only (never QR plaintext/hash)

## Activate (`PATCH .../status` → `ACTIVE`)

- Contiguous sequences starting at 1
- At least one active checkpoint
- QR methods (`QR_CODE`, `GPS_AND_QR`) require stored `qrCodeHash`
- Failures → `PATROL_ROUTE_HAS_NO_CHECKPOINTS`, `PATROL_ROUTE_CHECKPOINTS_INVALID`, `PATROL_CHECKPOINT_QR_REQUIRED`

## Archive

Soft archive sets `ARCHIVED` + `deletedAt`. Blocked when active patrol assignments exist (`PATROL_ROUTE_HAS_ACTIVE_ASSIGNMENTS`).

See also: [patrol-state-machine.md](./patrol-state-machine.md), [phase6-permissions.md](./phase6-permissions.md)
