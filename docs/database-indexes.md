# Database Indexes

Indexes target officer mobile, supervisor, and admin query patterns without redundant coverage of every column.

## High-value examples

| Area | Indexes |
|------|---------|
| Users | `(organisationId, role, status)`, `email` unique |
| Officers | `(organisationId, officerNumber)` unique, employment status |
| Sites | `(organisationId, code)` unique, `(clientId, status)` |
| Shifts | `(siteId, scheduledStartAt)`, `(organisationId, status, scheduledStartAt)` |
| Assignments | `(officerId, status, assignedAt)`, `(shiftId, officerId, status)` |
| Attendance | unique `assignmentId`, `(officerId, clockInServerAt)`, `(siteId, status)` |
| Patrols | `(patrolRouteId, sequence)` unique, visit `(patrolAssignmentId, patrolCheckpointId)` unique |
| Incidents | `(organisationId, incidentNumber)` unique, `(siteId, status)`, severity |
| Emergencies | `(organisationId, emergencyNumber)` unique, `(status, serverCreatedAt)` |
| Notifications | `(recipientUserId, readAt, createdAt)` |
| Idempotency | `(userId, key)` unique, `(expiresAt, status)` |
| Audit | `(organisationId, createdAt)`, `(entityType, entityId)` |

Partial unique constraints for “one active assignment” are intentionally left to services so historical cancelled/reassigned rows can remain.
