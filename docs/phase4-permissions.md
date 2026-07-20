# Phase 4 Permissions

Static role → permission map in `role-permissions.ts`. Effective permissions are embedded in JWT and returned from `/auth/me`. Server-side `@Permissions()` and service checks are authoritative.

## Role summaries

### SECURITY_OFFICER

Baseline workforce permissions plus Phase 4 self-read:

- `organisation:read:self`
- `officer:read:self`
- `device:read:self`
- `profile:read:self`, `profile:update:self`

Also includes pre-Phase-4 placeholders (shifts, attendance, incidents, patrols, SOS) for mobile contract alignment — **not backed by Phase 4 HTTP modules**.

### SUPERVISOR

Inherits officer permissions, plus:

- `officer:read`, `officer:read:assigned`
- `supervisor:read`
- `client:read`, `site:read`

Supervisors cannot create/update/archive org entities. Officer list/detail is limited to assigned officers.

### ADMINISTRATOR

Inherits supervisor permissions, plus full Phase 4 org management:

**Organisation:** `organisation:update:self`

**Users:** `user:create`, `user:read`, `user:update`, `user:disable`, `user:archive`, `user:unlock`, `user:reset-password`, `user:manage-role`, `user:manage`

**Officers:** `officer:create`, `officer:read`, `officer:update`, `officer:archive`, `officer:manage`

**Supervisors:** `supervisor:create`, `supervisor:read`, `supervisor:update`, `supervisor:archive`, `supervisor:assign-officer`

**Clients:** `client:create`, `client:read`, `client:update`, `client:archive`, `client:manage`

**Sites:** `site:create`, `site:read`, `site:update`, `site:archive`, `site:manage`

**Devices:** `device:read`, `device:approve`, `device:revoke`, `device:block`, `device:unblock`

Also: `shift:manage`, `assignment:manage`, `report:read`, `audit:read` (future phases).

### SUPER_ADMIN

Platform-only; **does not** inherit unrestricted tenant CRUD:

- `platform:manage`
- `organisation:read:any`
- `organisation:update:any`
- `organisation:suspend:any`
- `audit:read`

No automatic access to `/users`, `/officers`, `/clients`, etc. without org tenant context and matching permissions. Platform org HTTP endpoints are **not implemented** in Phase 4.

## Enforcement layers

1. **Route:** `@Permissions('resource:action')` guard
2. **Service:** `assertPermission()`, role-based access (e.g. officer `getById`)
3. **Device status:** `requiredPermissionForTransition()` per target status

## Policies tied to permissions

| Policy | Detail |
|--------|--------|
| No `SUPER_ADMIN` via org APIs | `user:create` / role change rejects `SUPER_ADMIN` |
| Last active admin | Demote, disable, or archive last `ACTIVE` `ADMINISTRATOR` → `USER_LAST_ADMIN_REQUIRED` |
| Self-service limits | No self role/status change; no self device activate/unblock |

## Related

- [authorization.md](./authorization.md)
- [tenant-scoping.md](./tenant-scoping.md)
