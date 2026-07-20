# Authorization

## Roles

- `SECURITY_OFFICER`
- `SUPERVISOR`
- `ADMINISTRATOR`
- `SUPER_ADMIN`

## Permissions (MVP code map)

Permissions are derived from role via `getPermissionsForRole` (no DB permission tables yet).

Officer examples: `attendance:create:self`, `incident:create:self`, `sos:create:self`  
Supervisor examples: `attendance:approve`, `incident:acknowledge`, `sos:respond`  
Administrator examples: `user:manage`, `site:manage`, `audit:read`  
Super admin: all of the above plus `platform:manage`

Effective permissions are returned on login and `/auth/me`.

Server checks remain authoritative. Future custom roles can replace the static map without changing JWT shape.
