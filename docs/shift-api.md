# Shift API

Base path: `/api/v1/shifts`

## Endpoints

| Method | Path | Permission |
|--------|------|------------|
| POST | `/shifts` | `shift:create` |
| GET | `/shifts` | `shift:read` |
| GET | `/shifts/:id` | `shift:read` or `shift:read:self` (service) |
| PATCH | `/shifts/:id` | `shift:update` |
| PATCH | `/shifts/:id/status` | `shift:update` |
| DELETE | `/shifts/:id` | `shift:archive` → 204 soft archive |

## Create rules

- `organisationId` from JWT
- Site must be ACTIVE in same organisation
- `scheduledEndAt` > `scheduledStartAt`
- Duration ≤ `SHIFT_MAX_DURATION_HOURS` (default 24)
- `unpaidBreakMinutes` ≤ shift duration
- Default status `SCHEDULED` unless `asDraft: true`

## Status transitions

`DRAFT→SCHEDULED|CANCELLED`, `SCHEDULED→IN_PROGRESS|CANCELLED`, `IN_PROGRESS→COMPLETED|CANCELLED(reason)`, `COMPLETED|CANCELLED→ARCHIVED`

Cancelling a shift cancels active assignments transactionally.
