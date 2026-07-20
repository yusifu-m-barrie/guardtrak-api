# Organisation API

Tenant-scoped organisation profile for the authenticated user's organisation.

**Base path:** `/api/v1/organisation`  
**Auth:** Bearer JWT  
**Tenant:** `organisationId` from JWT only (never from request body)

Platform organisation CRUD (`/organisations`, cross-tenant suspend) is **not implemented** in Phase 4. `SUPER_ADMIN` retains reserved `organisation:*:any` permissions for future platform services.

## Permissions

| Endpoint | Permission |
|----------|------------|
| `GET /organisation` | `organisation:read:self` |
| `PATCH /organisation` | `organisation:update:self` |

All organisation roles with officer baseline permissions can read. Only administrators (and roles inheriting Phase 4 admin permissions) can update.

## Endpoints

### GET /organisation

Returns the authenticated tenant organisation summary.

**Response `data` fields:** `id`, `code`, `name`, `legalName`, `registrationNumber`, `email`, `phone`, `address`, `countryCode`, `timezone`, `logoUrl`, `status`, `createdAt`, `updatedAt`.

Excluded from responses: internal fields such as `deletedAt`.

**Example:**

```http
GET /api/v1/organisation
Authorization: Bearer <access_token>
```

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "code": "GT-DEMO",
    "name": "GuardTrak Security Ltd",
    "legalName": "GuardTrak Security Limited",
    "timezone": "Africa/Freetown",
    "status": "ACTIVE"
  }
}
```

### PATCH /organisation

Updates safe profile fields. All body fields are optional.

| Field | Notes |
|-------|-------|
| `name`, `legalName` | Max 200 chars |
| `registrationNumber` | Max 64 chars |
| `email` | Valid email |
| `phone` | Max 32 chars |
| `address` | Max 500 chars |
| `countryCode` | ISO 3166-1 alpha-2 |
| `timezone` | IANA timezone |
| `logoUrl` | Valid URL |

**Example request:**

```json
{
  "name": "GuardTrak Security Ltd",
  "email": "contact@guardtrak.example",
  "timezone": "Africa/Freetown"
}
```

Audit: `UPDATE` on `Organisation` with `metadata.changedFields` (field names only).

## Errors

| Code | HTTP | When |
|------|------|------|
| `AUTH_ORGANISATION_REQUIRED` | 403 | JWT has no `organisationId` |
| `ORG_NOT_FOUND` | 404 | Organisation missing or soft-deleted |
| `AUTH_INSUFFICIENT_PERMISSION` | 403 | Missing permission |
| `VALIDATION_ERROR` | 400 | Invalid body |

## Related

- [tenant-scoping.md](./tenant-scoping.md)
- [phase4-permissions.md](./phase4-permissions.md)
