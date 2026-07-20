# Mobile Auth Contract

Base path: `/api/v1`

## Login

`POST /auth/login`

Request requires `organisationCode`, `employeeId`, `password`, `installationId`, `platform`.

Response includes `accessToken`, `refreshToken`, expiries, `user`, `officer`/`supervisor`, `permissions`.

Store access token in memory/SecureStore short-term; refresh token in SecureStore only. Never put tokens in URLs.

## Refresh / logout / me / change-password / reset

Match Phase 3 Nest routes under `/auth/*`.

On `mustChangePassword: true`, force change-password UI before normal navigation.

On `AUTH_REFRESH_REUSED` / `AUTH_SESSION_REVOKED` / `401`, clear tokens and return to login.

## Errors

See application codes such as `AUTH_INVALID_CREDENTIALS`, `AUTH_ACCOUNT_LOCKED`, `AUTH_PASSWORD_POLICY_FAILED`.
