# Phase 6 Patrol Permissions

## Permissions

| Permission | Purpose |
|---|---|
| `patrol-route:create` / `read` / `update` / `activate` / `archive` | Route lifecycle |
| `patrol-checkpoint:create` / `read` / `update` / `reorder` / `archive` | Checkpoint lifecycle |
| `patrol-assignment:create` / `read` / `read:self` / `update` / `cancel` / `review` | Patrol assignment lifecycle |
| `patrol-visit:create:self` / `read:self` / `read` / `review` / `override` | Visit capture and review |

## Role map

- **SECURITY_OFFICER:** route/checkpoint read, assignment `read:self`, visit create/read self
- **SUPERVISOR:** organisation read for routes/checkpoints/assignments/visits + assignment/visit review
- **ADMINISTRATOR:** full Phase 6 organisation permissions (inherits supervisor/officer)
- **SUPER_ADMIN:** no automatic tenant patrol CRUD

Access to a specific patrol assignment is still enforced in `PatrolAccessService` (self, linked supervisor, or admin override permission).
