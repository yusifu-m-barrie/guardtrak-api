# Client Management API

Organisation clients (contract holders) for sites and billing context.

**Base path:** `/api/v1/clients`  
**Auth:** Bearer JWT  
**Tenant:** JWT `organisationId`

## Permissions

| Endpoint | Permission |
|----------|------------|
| `POST /clients` | `client:create` |
| `GET /clients` | `client:read` |
| `GET /clients/:id` | `client:read` |
| `PATCH /clients/:id` | `client:update` |
| `PATCH /clients/:id/status` | `client:update` |
| `DELETE /clients/:id` | `client:archive` |

Supervisors have `client:read` only.

## Endpoints

### POST /clients

```json
{
  "name": "Example Holdings",
  "legalName": "Example Holdings Limited",
  "registrationNumber": "EX-2026-001",
  "primaryContactName": "Example Person",
  "primaryContactEmail": "contact@example.com",
  "primaryContactPhone": "+23279000000",
  "billingAddress": "Makeni, Sierra Leone",
  "operationalNotes": "24/7 coverage required"
}
```

Only `name` and `primaryContactName` are required.

### GET /clients

Paginated list. Query: `search`, `status`, `includeArchived`, sort. Default excludes archived (`deletedAt IS NULL`, status not `ARCHIVED`).

List/detail may include `siteCount` when computed.

### GET /clients/:id

Single client by UUID.

### PATCH /clients/:id

Update any create fields. `registrationNumber` must be unique per organisation.

### PATCH /clients/:id/status

```json
{ "status": "INACTIVE", "reason": "Contract ended" }
```

Setting `status=ARCHIVED` sets `deletedAt` and requires **no active sites** (see policy below).

### DELETE /clients/:id

Soft-archive: `status=ARCHIVED`, `deletedAt=now`. `204 No Content`. Same active-site guard as status archive.

## Archive policy

Cannot archive a client while it has **active sites** (non-archived, `deletedAt IS NULL`):

```json
{
  "success": false,
  "code": "CLIENT_HAS_ACTIVE_SITES",
  "message": "...",
  "status": 409
}
```

Archive or reassign sites first.

## Response fields

`id`, `name`, `legalName`, `registrationNumber`, contact fields, `billingAddress`, `operationalNotes`, `status`, `createdAt`, `updatedAt`, optional `siteCount`.

## Errors

| Code | HTTP | When |
|------|------|------|
| `CLIENT_NOT_FOUND` | 404 | Unknown or wrong tenant |
| `CLIENT_HAS_ACTIVE_SITES` | 409 | Archive with live sites |
| `CLIENT_REGISTRATION_CONFLICT` | 409 | Duplicate registration number |

## Related

- [site-management-api.md](./site-management-api.md)
- [soft-delete-policy.md](./soft-delete-policy.md)
