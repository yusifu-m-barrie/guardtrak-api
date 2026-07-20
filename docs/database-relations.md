# Database Relations

## Core ownership

```text
Organisation
  ├── User (nullable org for SUPER_ADMIN)
  ├── OfficerProfile / SupervisorProfile
  ├── Client → SecuritySite
  ├── Shift → Assignment → Attendance
  ├── PatrolRoute → PatrolCheckpoint
  ├── PatrolAssignment → PatrolVisit
  ├── Incident → IncidentNote / IncidentStatusEvent
  ├── Emergency → EmergencyStatusEvent
  ├── Evidence (metadata)
  ├── Notification → NotificationDelivery
  └── AuditLog / Sync* / IdempotencyRecord
```

## Critical named relations

- Multiple `User` links on `Incident`, `Emergency`, `Assignment`, etc. use explicit relation names (`IncidentReporterUser`, `EmergencyAcknowledger`, …).
- `Assignment.replacedAssignmentId` self-relation supports reassignment history.
- `RefreshSession.replacedBySessionId` supports token rotation families.

## Parent strategy for Evidence

Prefer setting one parent FK on `Evidence`. Soft IDs on attendance/patrol visits are for reverse lookup convenience only.
