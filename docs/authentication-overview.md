# Authentication Overview

## Status

Authentication is **not implemented in Phase 1**.

Foundation already prepared:

- JWT configuration placeholders (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, expiry settings)
- `@Public()`, `@Roles()`, `@CurrentUser()` decorators
- `JwtAuthGuard`, `RolesGuard`, and `PermissionsGuard` placeholders
- `RequestUser` and `AuthenticatedRequest` types
- Argon2 and Passport packages installed for Phase 3

## Rules

- Do not accept arbitrary user IDs from headers.
- Do not fake authentication for convenience.
- Do not register JWT bypasses in production.
- Guards are **not** globally enforced until Phase 3.

## Planned Phase 3 Flow

1. Login / refresh token endpoints
2. Passport JWT strategy
3. Global `JwtAuthGuard` with `@Public()` opt-out
4. Role and permission checks
5. Secure password hashing with Argon2
6. Token rotation and revocation strategy
