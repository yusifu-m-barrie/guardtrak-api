# Phase 7 Permissions

## Officer additions
- `evidence:upload:self`, `evidence:read:self`
- `support:create:self`, `support:read:self`
- `sync:submit:self`
- `notification:update:self`
- `device:push-token:self`

## Supervisor additions
- `incident:read`, `incident:assign`, `incident:close`, `incident:reopen`, `incident:escalate`, `incident:note`
- `evidence:read`, `evidence:verify`, `evidence:delete`
- `emergency:read`, `emergency:manage`
- `support:read`, `support:update`
- `report:read`

## Admin (`PHASE7_ADMIN_PERMISSIONS`)
- Full incident/evidence/notification broadcast/support/emergency/report/sync manage
- `faq:manage`

## Super Admin
No tenant CRUD — platform permissions only (unchanged).
