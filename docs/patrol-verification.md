# Patrol Checkpoint Verification

## Methods

| Method | Rules |
|---|---|
| `GPS` | Coordinates required; must be within snapshot `allowedRadiusMeters`; accuracy must meet minimum |
| `QR_CODE` | QR must match snapshot hash; GPS is captured for audit but is not authoritative for pass/fail |
| `GPS_AND_QR` | Both GPS geofence and QR must pass |
| `MANUAL_SUPERVISOR_OVERRIDE` | Officers cannot select; created only via visit override |

Submitted `verificationMethod` must match the assignment checkpoint snapshot configuration (no client downgrade).

## Sequential completion

When `PatrolRoute.requireSequentialCompletion` is true, only the next pending snapshot (from `PatrolProgressService`) may be visited. Out-of-order attempts return `PATROL_CHECKPOINT_OUT_OF_ORDER`.

## Outcomes

- Successful verification → `COMPLETED` (or `REQUIRES_REVIEW` when device time exceeds offline threshold)
- Outside geofence (GPS methods) → rejected (`PATROL_VISIT_OUTSIDE_GEOFENCE`)
- Invalid QR → rejected (`PATROL_VISIT_QR_INVALID`)
- Missing required photo/note → rejected

Supervisor endpoints: `POST /patrol-visits/:id/approve|reject|override`.
