# Device Management API

Registered mobile devices and administrator lifecycle controls.

**Base path:** `/api/v1/devices`  
**Auth:** Bearer JWT  
**Tenant:** JWT `organisationId`

Devices use **status-based retirement** (`REVOKED`), not `deletedAt`. See [soft-delete-policy.md](./soft-delete-policy.md).

## Permissions

| Endpoint | Permission |
|----------|------------|
| `GET /devices/me` | `device:read:self` |
| `GET /devices` | `device:read` |
| `GET /devices/:id` | Self owner or `device:read` |
| `PATCH /devices/:id/status` | Transition-specific (see below) |
| `DELETE /devices/:id` | `device:revoke` |

## Endpoints

### GET /devices/me

All devices for the authenticated user in the current organisation.

### GET /devices

Administrator list. Query: `page`, `limit`, `userId`, `status`, `platform`, `lastSeenFrom`, `lastSeenTo`, `search`, sort (`createdAt`, `lastSeenAt`, `status`, `platform`).

### GET /devices/:id

Owner may read own device without `device:read`. Others require `device:read`.

### PATCH /devices/:id/status

```json
{ "status": "BLOCKED", "reason": "Reported stolen" }
```

**Allowed transitions:**

| From | To |
|------|-----|
| `PENDING` | `ACTIVE`, `BLOCKED` |
| `ACTIVE` | `REVOKED`, `BLOCKED` |
| `REVOKED` | `ACTIVE` |
| `BLOCKED` | `ACTIVE` |

**Permission per transition:**

| Transition | Permission |
|------------|------------|
| → `ACTIVE` from `PENDING` or `REVOKED` | `device:approve` |
| → `ACTIVE` from `BLOCKED` | `device:unblock` |
| → `REVOKED` | `device:revoke` |
| → `BLOCKED` | `device:block` |

Invalid transitions: `400 DEVICE_STATUS_TRANSITION_INVALID`.

**Session revoke:** moving to `REVOKED` or `BLOCKED` revokes refresh sessions bound to that `deviceId`.

**Self-service rule:** users cannot activate or unblock their own devices (administrator action required).

Setting `ACTIVE` clears `revokedAt` and sets `trustedAt`.

### DELETE /devices/:id

Idempotent retire: sets `status=REVOKED`, `revokedAt=now`, revokes device sessions. `204 No Content`.

## Response fields

`id`, `userId`, `installationId`, `platform`, `deviceName`, `manufacturer`, `model`, `operatingSystem`, `operatingSystemVersion`, `appVersion`, `status`, `trustedAt`, `revokedAt`, `lastSeenAt`, timestamps.

Push tokens are **not** exposed in API responses.

## Errors

| Code | HTTP | When |
|------|------|------|
| `DEVICE_NOT_FOUND` | 404 | Unknown or wrong tenant |
| `DEVICE_ACCESS_FORBIDDEN` | 403 | Not owner and no `device:read`; self-activate |
| `DEVICE_STATUS_TRANSITION_INVALID` | 400 | Disallowed status change |

## Related

- [device-authentication.md](./device-authentication.md)
- [audit-redaction.md](./audit-redaction.md)
