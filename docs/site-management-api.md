# Site Management API

Security sites (geofenced locations) belonging to a client.

**Base path:** `/api/v1/sites`  
**Auth:** Bearer JWT  
**Tenant:** JWT `organisationId`

## Permissions

| Endpoint | Permission |
|----------|------------|
| `POST /sites` | `site:create` |
| `GET /sites` | `site:read` |
| `GET /sites/:id` | `site:read` |
| `PATCH /sites/:id` | `site:update` |
| `PATCH /sites/:id/status` | `site:update` |
| `DELETE /sites/:id` | `site:archive` |

Supervisors have `site:read` only.

## Endpoints

### POST /sites

```json
{
  "clientId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Makeni Main Office",
  "code": "MKN-HQ",
  "address": "Makeni, Sierra Leone",
  "latitude": 8.8833,
  "longitude": -12.05,
  "clockInRadiusMeters": 150,
  "clockOutRadiusMeters": 150,
  "checkpointDefaultRadiusMeters": 50,
  "minimumGpsAccuracyMeters": 50,
  "clockInOutsideGeofencePolicy": "REQUIRE_SUPERVISOR_APPROVAL",
  "clockOutOutsideGeofencePolicy": "ALLOW_WITH_REASON",
  "requiresClockInSelfie": false,
  "requiresPatrol": true,
  "instructions": "Report to reception on arrival"
}
```

`clientId` must belong to the same organisation.

### Geofence fields

| Field | Purpose |
|-------|---------|
| `latitude`, `longitude` | Site anchor (WGS84) |
| `clockInRadiusMeters`, `clockOutRadiusMeters` | Geofence radii (1–max configured) |
| `checkpointDefaultRadiusMeters` | Default patrol checkpoint radius |
| `minimumGpsAccuracyMeters` | Minimum acceptable GPS accuracy |
| `clockInOutsideGeofencePolicy`, `clockOutOutsideGeofencePolicy` | `REQUIRE_SUPERVISOR_APPROVAL`, `ALLOW_WITH_REASON`, `DENY` |

Geofence enforcement at clock-in/out is **Phase 5** (shifts/attendance).

### GET /sites

Paginated. Query: `search`, `clientId`, `status`, `includeArchived`, sort.

### GET /sites/:id

Includes nested `client` summary (`id`, `name`, `status`) when loaded.

### PATCH /sites/:id

Update site and geofence fields. `code` unique per organisation.

### PATCH /sites/:id/status

```json
{ "status": "INACTIVE", "reason": "Renovation" }
```

`ARCHIVED` sets `deletedAt`.

**Future constraint (Phase 5):** archiving will be blocked when the site has future scheduled shifts. Not enforced until shift APIs exist.

### DELETE /sites/:id

Soft-archive: `status=ARCHIVED`, `deletedAt=now`. `204 No Content`.

## Response fields

Site payload includes geofence settings, feature flags (`requiresClockInSelfie`, `requiresPatrol`, etc.), `status`, timestamps, optional `client` summary.

## Errors

| Code | HTTP | When |
|------|------|------|
| `SITE_NOT_FOUND` | 404 | Unknown or archived |
| `CLIENT_NOT_FOUND` | 404 | Invalid `clientId` |
| `VALIDATION_ERROR` | 400 | Out-of-range coordinates/radii |

## Related

- [client-management-api.md](./client-management-api.md)
- [backend-roadmap.md](./backend-roadmap.md) (Phase 5 shifts)
