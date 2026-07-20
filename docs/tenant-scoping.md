# Tenant Scoping

All Phase 4 organisation data APIs are **single-tenant**. The active organisation comes from the authenticated JWT, never from the request body or query.

## Source of truth

| Context | Field |
|---------|-------|
| JWT / `RequestUser` | `organisationId`, `role`, `permissions` |
| Route handlers | `@CurrentUser()` |
| Services | `requireOrganisationId(actor)` |

```typescript
// Every org-scoped service starts with:
const organisationId = requireOrganisationId(actor);
```

If `organisationId` is missing → `403 AUTH_ORGANISATION_REQUIRED`.

## Query patterns

Repositories filter by `organisationId` from auth:

- **Lists:** `where: { organisationId, deletedAt: null, ... }`
- **Get by ID:** `findFirst({ where: { id, organisationId, ... } })`
- **Cross-tenant IDs:** return `404` (same as not found) via `tenantNotFound()`

Never accept `organisationId` in create/update DTOs.

## Role-specific scoping

| Role | Behaviour |
|------|-----------|
| `ADMINISTRATOR` | Full org CRUD within Phase 4 permissions |
| `SUPERVISOR` | Read clients/sites; read assigned officers only on officer list/detail |
| `SECURITY_OFFICER` | Self officer profile (`/officers/me`); own devices (`/devices/me`) |
| `SUPER_ADMIN` | May have `organisationId = null` (platform login). **No** automatic tenant bypass on org routes — org APIs require tenant context |

## Platform org endpoints (deferred)

Cross-tenant organisation management (`organisation:read:any`, `organisation:update:any`, `organisation:suspend:any`) is reserved for future platform services. Phase 4 implements **self** organisation only (`/organisation`).

## PostgreSQL RLS

Row-level security is **not** enabled. Application-layer scoping is authoritative.

## Related

- [tenant-auth-context.md](./tenant-auth-context.md)
- [phase4-permissions.md](./phase4-permissions.md)
