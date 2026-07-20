# Patrol State Machines

Authoritative maps: `patrol-transitions.util.ts`. Invalid transitions → 409.

## Route (`PatrolRouteStatus`)

| From | Allowed to |
|------|------------|
| `DRAFT` | `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| `ACTIVE` | `INACTIVE`, `ARCHIVED` |
| `INACTIVE` | `ACTIVE`, `ARCHIVED` |

Activation has additional business guards (checkpoints, sequences, QR hashes). Error: `PATROL_ROUTE_STATUS_INVALID`.

## Assignment (`PatrolAssignmentStatus`)

| From | Allowed to |
|------|------------|
| `NOT_STARTED` | `IN_PROGRESS`, `CANCELLED`, `MISSED` |
| `IN_PROGRESS` | `COMPLETED`, `PARTIALLY_COMPLETED`, `CANCELLED`, `MISSED`, `REQUIRES_REVIEW` |
| `REQUIRES_REVIEW` | `COMPLETED`, `PARTIALLY_COMPLETED`, `CANCELLED` |

Active set (blocks route archive / duplicate create): `NOT_STARTED`, `IN_PROGRESS`, `REQUIRES_REVIEW`.

Error: `PATROL_ASSIGNMENT_STATUS_INVALID`.

## Visit (`CheckpointStatus`)

Not a closed transition map; set by verification/review:

- Success → `COMPLETED` (or `REQUIRES_REVIEW` for offline skew)
- Review approve → `COMPLETED`
- Review reject → `MISSED`
- Override → `COMPLETED` | `SKIPPED` | `MISSED`

`PatrolAssignmentEvent` records assignment status changes with actor + reason.
