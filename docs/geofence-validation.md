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

Future: PostGIS `ST_DWithin` for indexed geo queries.
