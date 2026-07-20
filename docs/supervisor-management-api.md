# Supervisor Management API

Supervisor profiles, officer assignments, and soft-ended relations.

**Base path:** `/api/v1/supervisors`  
**Auth:** Bearer JWT  
**Tenant:** JWT `organisationId`

## Permissions

| Endpoint | Permission |
|----------|------------|
| `POST /supervisors` | `supervisor:create` |
| `GET /supervisors` | `supervisor:read` |
| `GET /supervisors/me` | `supervisor:read` |
| `GET /supervisors/:id` | `supervisor:read` (service check) |
| `PATCH /supervisors/:id` | `supervisor:update` |
| `POST /supervisors/:id/officers` | `supervisor:assign-officer` |
| `GET /supervisors/:id/officers` | `supervisor:read` |
| `DELETE /supervisors/:id/officers/:officerId` | `supervisor:assign-officer` |
| `DELETE /supervisors/:id` | `supervisor:archive` |

## Endpoints

### POST /supervisors

Transactional User + SupervisorProfile create (role `SUPERVISOR`).

```json
{
  "user": {
    "employeeId": "SUP-003",
    "email": "supervisor3@example.com",
    "firstName": "Aminata",
    "lastName": "Koroma",
    "temporaryPassword": "Strong!Temporary2026"
  },
  "profile": {
    "supervisorNumber": "GT-SUP-003",
    "title": "Shift Supervisor"
  }
}
```

### GET /supervisors

Paginated. Query: `search`, `createdFrom`, `createdTo`, `includeArchived`, sort (`createdAt`, `supervisorNumber`).

### GET /supervisors/me

Returns `user`, `profile`, and active `assignedOfficers`.

### GET /supervisors/:id

Single supervisor `{ profile, user }`.

### PATCH /supervisors/:id

Update nested `user` / `profile` fields.

### POST /supervisors/:id/officers

Assign one or more officers. Creates `SupervisorOfficer` rows (no physical delete on unassign).

```json
{
  "officerIds": [
    "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "550e8400-e29b-41d4-a716-446655440000"
  ],
  "activeFrom": "2026-04-01T00:00:00.000Z",
  "activeUntil": "2026-12-31T23:59:59.999Z"
}
```

`activeUntil` optional (open-ended). Must be after `activeFrom`. Officers must be active/assignable; duplicate active relations rejected.

**Response:** `{ supervisorId, assigned: [{ relationId, officerId, activeFrom, activeUntil }] }`

### GET /supervisors/:id/officers

Paginated assigned officers. Query: `activeOnly` (default `true`), `search`.

Each item: `{ relationId, activeFrom, activeUntil, officer: { profile, user } }`.

### DELETE /supervisors/:id/officers/:officerId

Soft-end assignment: sets `activeUntil=now`. `204 No Content`. Row retained for history.

### DELETE /supervisors/:id

Archive supervisor profile and user; end all active officer links. `204 No Content`.

## Assignment policy

- Relations are **never hard-deleted**; unassign sets `activeUntil`.
- Active link: `activeUntil IS NULL OR activeUntil > now`.
- Officer archive also ends active supervisor links.

## Errors

| Code | HTTP | When |
|------|------|------|
| `SUPERVISOR_NOT_FOUND` | 404 | Unknown or archived |
| `OFFICER_NOT_FOUND` | 404 | Officer outside tenant |
| `SUPERVISOR_OFFICER_RELATION_NOT_FOUND` | 404 | No active relation to end |
| `VALIDATION_ERROR` | 400 | `activeUntil` before `activeFrom` |

## Related

- [officer-management-api.md](./officer-management-api.md)
- [soft-delete-policy.md](./soft-delete-policy.md)
