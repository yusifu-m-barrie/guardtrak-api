# Token Rotation

1. Client presents refresh token.
2. Server hashes and loads `RefreshSession`.
3. If revoked → revoke family → `AUTH_REFRESH_REUSED` → require login.
4. If expired → `AUTH_TOKEN_EXPIRED`.
5. Otherwise create replacement session in the same family, revoke old session, set `replacedBySessionId`.
6. Issue new access + refresh pair.

Refresh tokens are never stored in plaintext.
