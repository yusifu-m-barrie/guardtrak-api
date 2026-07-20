# Soft Delete Policy

Phase 4 uses **soft delete / archive** for operational history. Hard deletes are avoided for entities with downstream references.

## General pattern

| Mechanism | Usage |
|-----------|--------|
| `status = ARCHIVED` | Business-visible retirement |
| `deletedAt = timestamp` | Excluded from default queries |
| `includeArchived=true` | List query flag where supported |

Default list/find queries filter `deletedAt IS NULL` and often `status != ARCHIVED`.

## By entity

### User

- Archive: `DELETE /users/:id` or status flow to `ARCHIVED`
- Sets `status=ARCHIVED`, `deletedAt=now`
- Revokes refresh sessions
- Officers/supervisors archived via their own endpoints also update linked user

### Officer / Supervisor profile

- Archive: `DELETE /officers/:id`, `DELETE /supervisors/:id`
- Profile `deletedAt` + linked user `ARCHIVED`
- Officer archive ends active `SupervisorOfficer` links (`activeUntil=now`)
- Supervisor archive ends all active officer assignments

### Client / Site

- Archive: `DELETE` or `PATCH .../status` with `ARCHIVED`
- Sets `deletedAt` on archive
- Client archive blocked if active sites exist (`CLIENT_HAS_ACTIVE_SITES`)

### SupervisorOfficer assignment

- **Not deleted.** Unassign sets `activeUntil=now`; row kept for audit/history.

### Device (exception)

- **No `deletedAt`.** Retirement uses `status=REVOKED` and `revokedAt`.
- `DELETE /devices/:id` is an idempotent revoke, not a row delete.
- Push tokens cascade on device hard delete at DB layer only; API never hard-deletes devices in Phase 4.

### Organisation

- Soft-deleted orgs (`deletedAt`) are invisible to `/organisation` self routes.
- Platform suspend/archive workflows deferred.

## Session side effects

Sessions revoked on archive/disable/suspend for users; on `REVOKED`/`BLOCKED` for devices; on officer employment `SUSPENDED`/`TERMINATED`/`ARCHIVED`.

## Database layer

See [database-delete-policy.md](./database-delete-policy.md) for FK `Restrict` vs `Cascade` rules. Application archive aligns with DB constraints — entities with operational children cannot be hard-deleted.

## Related

- [user-management-api.md](./user-management-api.md)
- [device-management-api.md](./device-management-api.md)
