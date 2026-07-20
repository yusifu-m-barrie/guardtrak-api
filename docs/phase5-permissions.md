# Phase 5 Permissions

Server-authoritative permissions for shifts, assignments, attendance, and breaks.

## SECURITY_OFFICER

- `shift:read:self`
- `assignment:read:self`
- `assignment:confirm:self`
- `attendance:clock-in:self`
- `attendance:clock-out:self`
- `attendance:read:self`
- `break:start:self`
- `break:end:self`
- `break:read:self`

## SUPERVISOR

- `shift:read`
- `assignment:read`
- `attendance:read`
- `attendance:review`
- `attendance:approve`
- `break:read`
- `break:review`

## ADMINISTRATOR

Organisation-level Phase 5 permissions including create/update/cancel/archive/reassign/correct/void.

## SUPER_ADMIN

No automatic ordinary tenant CRUD access.

`shift:manage` and `assignment:manage` remain admin aliases alongside granular permissions.
