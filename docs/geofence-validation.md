# Geofence Validation

MVP uses Haversine distance in `GeofenceService` (no PostGIS).

## Output

- `distanceMeters` (raw; rounded only for presentation)
- Policy evaluation against site radius

## Policies (`GeofencePolicy`)

| Policy | Outside radius |
|--------|----------------|
| `BLOCK` | Reject (`ATTENDANCE_OUTSIDE_GEOFENCE`) |
| `ALLOW_WITH_REASON` | Require non-empty reason; mark warning/review |
| `REQUIRE_SUPERVISOR_APPROVAL` | Allow; set `PENDING_SUPERVISOR_APPROVAL` |

## GPS accuracy

If `accuracyMeters` > site `minimumGpsAccuracyMeters`, reject with `ATTENDANCE_GPS_ACCURACY_TOO_LOW`.

Coordinates must be in range before calculation.

## `ATTENDANCE_GEOFENCE_ENABLED`

Config flag — do not hardcode bypasses in controllers.

| Value | Location rejection | GPS stored |
| --- | --- | --- |
| `true` (production/staging default if unset in `configuration.ts`) | Yes (site radius + GPS accuracy) | Yes |
| `false` | No | Yes (`clockInLatitude` / `longitude` / `accuracyMeters` / `distanceMeters`) |

Clock-in / clock-out still require a valid assignment occurrence and the allowed time window when this flag is `false`.

Future: PostGIS `ST_DWithin` for indexed geo queries.
