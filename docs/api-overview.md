# GuardTrak API Overview

GuardTrak API is the NestJS backend for the GuardTrak security workforce management platform.

## Base URL

All versioned REST endpoints use URI versioning:

```text
/api/v1
```

Example:

```text
GET /api/v1/health
```

## Current Phase

**Phase 1 — Foundation and architecture**

Available now:

- Environment configuration and validation
- Global request/response and error envelopes
- Prisma database foundation
- Health and readiness endpoints
- Swagger (development/staging)
- Rate limiting
- Security decorator/guard placeholders (not enforced globally yet)

Authentication, domain modules, and the full database schema are deferred.

## Success Response Envelope

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "requestId": "uuid"
}
```

HTTP `204 No Content` responses are not wrapped with a body.

## Error Response Envelope

See [error-contract.md](./error-contract.md).

## Swagger

When enabled (development/staging by default):

```text
GET /docs
```

Swagger is disabled in production unless `ENABLE_SWAGGER=true`.

## API Versioning

See [api-versioning.md](./api-versioning.md).

## Related Documents

- [authentication-overview.md](./authentication-overview.md)
- [idempotency.md](./idempotency.md)
- [environment.md](./environment.md)
- [backend-roadmap.md](./backend-roadmap.md)
