# Officer Management API

Officer profiles linked to `User` records. Create is transactional (User + OfficerProfile).

**Base path:** `/api/v1/officers`  
**Auth:** Bearer JWT  
**Tenant:** JWT `organisationId`

## Permissions

| Endpoint | Permission |
|----------|------------|
| `POST /officers` | `officer:create` |
| `GET /officers` | `officer:read` |
| `GET /officers/me` | `officer:read:self` |
| `GET /officers/:id` | Service-level (see access) |
| `PATCH /officers/:id` | `officer:update` |
| `PATCH /officers/:id/employment-status` | `officer:update` |
| `DELETE /officers/:id` | `officer:archive` |

## Access rules (GET /officers/:id)

No route-level permission decorator; service enforces:

- **Administrator:** any org officer
- **Security officer:** own profile only (`officer:read:self`)
- **Supervisor:** assigned officers only (`officer:read:assigned`)
- Others: `403 OFFICER_ACCESS_FORBIDDEN`

List (`GET /officers`): administrators see all; supervisors see assigned officers only.

## Endpoints

### POST /officers

Transactional create of user + profile.

```json
{
  "user": {
    "employeeId": "OFF-003",
    "email": "officer3@example.com",
    "firstName": "Ibrahim",
    "lastName": "Bangura",
    "temporaryPassword": "Strong!Temporary2026"
  },
  "profile": {
    "officerNumber": "GT-OFF-003",
    "hireDate": "2026-03-01"
  }
}
```

Optional profile fields on create: `nationalIdNumber`, `dateOfBirth`, emergency contacts, `rankOrTitle`, etc.

User role is set to `SECURITY_OFFICER`. Returns `{ profile, user }`.

### GET /officers

Query: pagination, `search`, `employmentStatus`, `includeArchived`, sort (`createdAt`, `officerNumber`, `hireDate`, `updatedAt`).

Administrators receive `profile.notes`; other roles do not.

### GET /officers/me

Officer self view: `user`, `profile`, `organisation` summary, active `supervisors` links.

### PATCH /officers/:id

Update nested `user` and/or `profile`. Admin-only profile fields: `officerNumber`, `hireDate`, `nationalIdNumber`, `dateOfBirth`, `notes`.

### PATCH /officers/:id/employment-status

```json
{ "employmentStatus": "SUSPENDED", "reason": "Leave of absence" }
```

Values: `ACTIVE`, `ON_LEAVE`, `SUSPENDED`, `TERMINATED`, `ARCHIVED`. May sync linked user `status` and revoke sessions for `SUSPENDED`, `TERMINATED`, `ARCHIVED`.

### DELETE /officers/:id

Soft-archive officer profile and linked user (`ARCHIVED` + `deletedAt`). Ends active supervisor assignments (`activeUntil=now`). `204 No Content`.

## Response redaction

API responses **never** include `nationalIdNumber`, `dateOfBirth`, or `passwordHash`. Administrators may set these via PATCH/create; they are stored but not returned in list/detail payloads.

## Errors

| Code | HTTP | When |
|------|------|------|
| `OFFICER_NOT_FOUND` | 404 | Unknown, archived, or not accessible |
| `OFFICER_ACCESS_FORBIDDEN` | 403 | Role cannot access target |
| `USER_EMAIL_CONFLICT` | 409 | Duplicate email on create |

## Related

- [supervisor-management-api.md](./supervisor-management-api.md)
- [audit-redaction.md](./audit-redaction.md)
