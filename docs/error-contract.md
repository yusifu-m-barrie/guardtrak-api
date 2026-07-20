# Error Contract

All handled errors return:

```json
{
  "success": false,
  "message": "User-friendly message",
  "code": "ERROR_CODE",
  "errors": [],
  "requestId": "uuid",
  "timestamp": "ISO-8601",
  "path": "/api/v1/..."
}
```

## Principles

- Meaningful HTTP status codes are preserved.
- Stack traces are not returned in production.
- SQL queries and secrets are never exposed.
- Validation failures use `code: VALIDATION_ERROR` with field-level `errors` when available.

## Common Codes

| Code | Typical HTTP status |
|------|---------------------|
| `VALIDATION_ERROR` | 400 |
| `BAD_REQUEST` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `IDEMPOTENCY_CONFLICT` | 409 |
| `RATE_LIMITED` | 429 |
| `DATABASE_ERROR` | 400/503 |
| `SERVICE_UNAVAILABLE` | 503 |
| `INTERNAL_ERROR` | 500 |
| `NOT_IMPLEMENTED` | 401/501 |

Prisma errors are mapped through a placeholder mapper and will be expanded in later phases.
