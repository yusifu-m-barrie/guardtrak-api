# User Management API

Organisation user account lifecycle for administrators.

**Base path:** `/api/v1/users`  
**Auth:** Bearer JWT  
**Tenant:** scoped to JWT `organisationId`

## Permissions

| Endpoint | Permission |
|----------|------------|
| `POST /users` | `user:create` |
| `GET /users` | `user:read` |
| `GET /users/:id` | `user:read` |
| `PATCH /users/:id` | `user:update` |
| `PATCH /users/:id/role` | `user:manage-role` |
| `PATCH /users/:id/status` | `user:disable` |
| `POST /users/:id/unlock` | `user:unlock` |
| `POST /users/:id/force-password-reset` | `user:reset-password` |
| `DELETE /users/:id` | `user:archive` |

## Endpoints

### POST /users

Creates an organisation user with a temporary password.

**Body (required):** `employeeId`, `email`, `firstName`, `lastName`, `role`, `temporaryPassword`  
**Optional:** `phone`, `middleName`, `displayName`, `mustChangePassword` (default `true`)

**Assignable roles:** `SECURITY_OFFICER`, `SUPERVISOR`, `ADMINISTRATOR` — not `SUPER_ADMIN`.

```json
{
  "employeeId": "ADM-002",
  "email": "admin2@example.com",
  "firstName": "Fatmata",
  "lastName": "Sesay",
  "role": "ADMINISTRATOR",
  "temporaryPassword": "Strong!Temporary2026"
}
```

### GET /users

Paginated list. Query: `page`, `limit`, `sortBy`, `sortOrder`, `search`, `role`, `status`, `createdFrom`, `createdTo`, `includeArchived` (default `false`).

Sort fields: `createdAt`, `firstName`, `lastName`, `email`, `employeeId`, `role`, `status`.

### GET /users/:id

Single user by UUID. Returns 404 if outside tenant or archived (unless listing with `includeArchived`).

### PATCH /users/:id

Profile update: `email`, `phone`, `firstName`, `middleName`, `lastName`, `displayName`, `avatarUrl`.

### PATCH /users/:id/role

```json
{ "role": "SUPERVISOR" }
```

Policies: cannot change own role; cannot assign `SUPER_ADMIN`; demoting the last active administrator is blocked (`USER_LAST_ADMIN_REQUIRED`).

### PATCH /users/:id/status

```json
{ "status": "SUSPENDED", "reason": "Policy violation" }
```

Allowed transitions: `INVITED→ACTIVE`; `ACTIVE↔SUSPENDED|DISABLED`. Cannot change own status. Suspending/disabling the last active administrator is blocked.

Session revoke on `SUSPENDED`, `DISABLED`, `ARCHIVED`.

### POST /users/:id/unlock

Clears `failedLoginAttempts` and `lockedUntil`.

### POST /users/:id/force-password-reset

Sets `mustChangePassword: true` and revokes all refresh sessions.

### DELETE /users/:id

Soft-archive: `status=ARCHIVED`, `deletedAt=now`, sessions revoked. `204 No Content`.

Policies: cannot archive self; last active administrator protection applies.

## Response shape

User objects exclude `passwordHash`, `deletedAt`, and lockout internals. Includes: `id`, `organisationId`, `employeeId`, `email`, `phone`, names, `role`, `status`, `avatarUrl`, `mustChangePassword`, `lastLoginAt`, `passwordChangedAt`, timestamps.

## Errors

| Code | HTTP | When |
|------|------|------|
| `USER_ROLE_FORBIDDEN` | 403 | `SUPER_ADMIN` assignment or self role change |
| `USER_LAST_ADMIN_REQUIRED` | 409 | Last active admin demote/disable/archive |
| `USER_SELF_STATUS_CHANGE_FORBIDDEN` | 403 | Self status/archive |
| `USER_ALREADY_ARCHIVED` | 409 | Re-archive |
| `USER_EMAIL_CONFLICT` | 409 | Duplicate email |
| `USER_EMPLOYEE_ID_CONFLICT` | 409 | Duplicate employee ID in org |
| `USER_NOT_FOUND` | 404 | Unknown or wrong tenant |

## Related

- [soft-delete-policy.md](./soft-delete-policy.md)
- [phase4-permissions.md](./phase4-permissions.md)
