# Security Guide (Phase 9)

Enterprise hardening controls for GuardTrak API. **Mode A** (local PostgreSQL 18 + `npm run start:dev`) is the default development path; production settings below apply to **Mode B**.

Related: [password-policy.md](./password-policy.md), [token-rotation.md](./token-rotation.md), [device-authentication.md](./device-authentication.md), [security-notes.md](./security-notes.md).

---

## Refresh token families

Each login creates a **refresh family** (`familyId` UUID on `RefreshSession`). Rotation keeps the same family:

1. Client presents refresh token.
2. Server validates hash, expiry, and revocation state.
3. A new session is created in the **same family**; the old session is revoked with `replacedBySessionId`.
4. Client receives a new access + refresh pair.

Families allow bulk revocation when reuse is detected or when a user signs out everywhere.

See [token-rotation.md](./token-rotation.md).

---

## Refresh reuse detection

If a client presents a refresh token that was **already rotated** (revoked with a replacement):

- The entire **family** is revoked (`SessionService.revokeFamily`).
- Response: `401` with `AUTH_REFRESH_REUSED`.
- A `SECURITY_EVENT` audit entry is recorded when Phase 9 audit actions are active.

This mitigates token theft: an attacker reusing a stolen old token invalidates the whole chain.

---

## Password history (last 5)

Password changes and successful resets store the **previous** Argon2 hash in `password_histories`. The new password must not match:

- The current hash, or
- Any of the last **N** history entries (default **5**, configurable).

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_PASSWORD_HISTORY_COUNT` | `5` | Number of prior hashes to retain and check |
| `AUTH_PASSWORD_MAX_AGE_DAYS` | `0` | `0` = disabled; when set, stale passwords may force `mustChangePassword` on login |

Reuse returns `400` with `AUTH_PASSWORD_REUSE`.

---

## Session fingerprint

On login and refresh, the API computes a short fingerprint:

```text
sha256(`${userAgent}|${platform}`).slice(0, 32)
```

Stored on `RefreshSession.fingerprint` for anomaly detection.

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_STRICT_FINGERPRINT` | `false` | When `true`, fingerprint mismatch on refresh **fails** the request |

When `false` (default), mismatches log a `SECURITY_EVENT` audit but allow refresh (mobile UA changes, OS updates).

---

## Device trust

`devices.trustScore` (0–100, default 50) reflects device reliability:

| Event | Trust adjustment |
|-------|------------------|
| New pending device | `20` |
| Approved / trusted login | `+10` (cap 100) |
| Revoked / blocked | `0` |

Tenant admins manage devices via `/api/v1/devices`. `AUTH_NEW_DEVICE_AUTO_APPROVE=false` in production requires explicit approval before login.

---

## Rate limiting

Global throttling via `@nestjs/throttler` (`ThrottlerGuard` in `AppModule`):

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_TTL` | `60000` | Window in milliseconds |
| `RATE_LIMIT_LIMIT` | `100` | Max requests per window per IP |

Exceeded limits return `429` with `RATE_LIMITED`. Tune per environment; stricter limits on auth routes may be added in future phases.

---

## Helmet and HTTP hardening

`main.ts` applies:

- **Helmet** — CSP enabled in production; disabled in development for Swagger.
- **Compression** — when `COMPRESSION_ENABLED=true`.
- **Body size limits** — tied to `MAX_IMAGE_SIZE_BYTES` for JSON/urlencoded.
- **CORS** — explicit origin list; credentials enabled.
- **Trust proxy** — `TRUST_PROXY=true` behind Nginx for correct client IP (rate limits, audit).

Response headers (Phase 9): `X-API-Version: v1`, `X-API-Deprecation: false`.

---

## Storage quotas

Organisations may have `storageQuotaBytes` and tracked `storageUsedBytes`. Evidence uploads that would exceed quota return `STORAGE_QUOTA_EXCEEDED`.

| Variable | Description |
|----------|-------------|
| `STORAGE_ORG_QUOTA_BYTES` | Optional platform default quota (bytes); per-org override in database |

---

## Placeholders (future integration)

These hooks exist as extension points — **not active enforcement** until external providers are wired:

| Capability | Status | Notes |
|------------|--------|-------|
| Geo-IP enrichment | Placeholder | Login audit may accept country/region when a provider is configured |
| IP reputation | Placeholder | Block/score suspicious IPs before auth handlers |
| Virus scan | Placeholder | `VirusScanHook.scan()` no-op on evidence complete |
| Thumbnail generation | Queue stub | `thumbnails` queue job |

Document provider choice (MaxMind, Cloudflare, ClamAV, etc.) when implementing.

---

## Production checklist (security)

- [ ] `NODE_ENV=production`
- [ ] Strong JWT secrets (no `change-me`)
- [ ] `AUTH_ALLOW_DEV_OTP_OUTPUT=false`
- [ ] `AUTH_NEW_DEVICE_AUTO_APPROVE=false`
- [ ] `AUTH_STRICT_FINGERPRINT=true` if mobile UA stability is acceptable
- [ ] `TRUST_PROXY=true` behind reverse proxy
- [ ] `RATE_LIMIT_*` tuned for expected traffic
- [ ] TLS terminated at Nginx; Postgres/Redis not public

See [production.env.example](./production.env.example) and [deployment-checklist.md](./deployment-checklist.md).
