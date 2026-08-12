# Authentication

## Login strategy (Strategy B)

Organisation-scoped employee IDs require an explicit tenancy code:

```json
{
  "organisationCode": "FOLPS",
  "employeeId": "OFF-001",
  "password": "...",
  "installationId": "...",
  "platform": "ANDROID"
}
```

Platform super-admins use `organisationCode: "PLATFORM"` with a null `organisationId` user.

There is no silent cross-organisation employee ID lookup.

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/auth/login` | Public |
| POST | `/api/v1/auth/refresh` | Public |
| POST | `/api/v1/auth/forgot-password` | Public |
| POST | `/api/v1/auth/verify-otp` | Public |
| POST | `/api/v1/auth/reset-password` | Public |
| POST | `/api/v1/auth/logout` | Bearer |
| POST | `/api/v1/auth/logout-all` | Bearer |
| GET | `/api/v1/auth/me` | Bearer |
| POST | `/api/v1/auth/change-password` | Bearer |

## Tokens

- Access token: signed JWT (`type=access`), short-lived, includes `sub`, `organisationId`, `role`, `sessionId`, `deviceId`.
- Refresh token: opaque random string, stored as SHA-256 hash in `RefreshSession`.
- Rotation: each refresh issues a new refresh token and revokes the previous session (`replacedBySessionId`).
- Reuse of a revoked refresh token revokes the entire token family.

## Guards

Global `JwtAuthGuard` + `RolesGuard`. Use `@Public()` to opt out. Roles/permissions are never taken from client headers.
