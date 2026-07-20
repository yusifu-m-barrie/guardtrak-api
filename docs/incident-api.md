# Incident API (Phase 7)

Base path: `/api/v1/incidents` (JWT required).

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| POST | `/incidents` | `incident:create:self` | Idempotent via `idempotencyKey` |
| GET | `/incidents` | scoped | Officer=self; Supervisor=assigned/linked; Admin=org |
| GET | `/incidents/statistics` | scoped | Counts by status/severity/priority |
| GET | `/incidents/:id` | scoped | Tenant-safe 404 |
| PATCH | `/incidents/:id` | create:self or manage | Limited fields |
| POST | `/incidents/:id/assign` | `incident:assign` | Optional ACK transition |
| POST | `/incidents/:id/close` | `incident:close` | Requires resolutionSummary |
| POST | `/incidents/:id/reopen` | `incident:reopen` | CLOSED/REJECTED → UNDER_REVIEW |
| POST | `/incidents/:id/escalate` | `incident:escalate` | Notifies admins |
| POST | `/incidents/:id/notes` | read access | Visibility filtered |
| GET | `/incidents/:id/timeline` | read access | Status events + notes |

Create notifies supervisors/admins (`INCIDENT_SUBMITTED`). Soft-delete via `deletedAt` when needed.
