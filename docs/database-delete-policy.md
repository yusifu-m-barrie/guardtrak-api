# Database Delete Policy

## Principles

- Prefer **archive / soft-delete** (`deletedAt`, status enums) over hard delete for operational history.
- Prefer `onDelete: Restrict` / `NoAction` for historical links (attendance, incidents, assignments, organisations).
- Use `onDelete: Cascade` only for dependent satellite rows.
- Use `onDelete: SetNull` for optional actors/reviewers.

## Cascade (allowed)

| Parent | Children |
|--------|----------|
| User | RefreshSession, PasswordResetToken, NotificationPreference, Notifications (recipient) |
| Device | PushToken |
| Assignment | AssignmentEvent |
| Notification | NotificationDelivery |
| SupportRequest | SupportMessage |
| SupervisorProfile / OfficerProfile | SupervisorOfficer join rows |

## Restrict (protect history)

Organisation, User, OfficerProfile, Client, SecuritySite, Shift, Assignment, Attendance, Patrol*, Incident, Emergency — deleting parents with operational children is blocked at the database layer.

## Organisation deletion

Do not cascade-erase production operational data. Organisation removal is an administrative archival workflow, not a hard delete.

## Circular cascades

No cascade path should erase attendance/incident history via user deletion. Users with history should be archived (`AccountStatus.ARCHIVED` + `deletedAt`).
