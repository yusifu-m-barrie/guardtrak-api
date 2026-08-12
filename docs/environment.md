# Environment Configuration

Copy `.env.example` to `.env`. Never commit `.env`.

See also:

- [deployment.md](./deployment.md) — Mode A / Mode B
- [deployment-checklist.md](./deployment-checklist.md)
- [postgresql-backup.md](./postgresql-backup.md)
- [postgresql-restore.md](./postgresql-restore.md)

---

## Mode A — Development (local PostgreSQL 18)

Default workstation setup. **No Docker required.**

```env
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/guardtrak?schema=public
STORAGE_PROVIDER=local
STORAGE_LOCAL_ROOT=./storage
REDIS_ENABLED=false
EMAIL_ENABLED=false
FCM_ENABLED=false
AUTH_ALLOW_DEV_OTP_OUTPUT=true
AUTH_NEW_DEVICE_AUTO_APPROVE=true
TRUST_PROXY=false
```

`DATABASE_URL` must point at your **local PostgreSQL 18** instance (direct `postgresql://` URL — not `prisma+postgres://`).

---

## Railway

Private `*.railway.internal` URLs only work when API + Postgres are in the **same** Railway project. Across projects, use `DATABASE_PUBLIC_URL` (`*.rlwy.net`) with `?sslmode=require`.

### Fresh database = no tables

Until migrations run, login/refresh return `DATABASE_ERROR`. Fix once:

```powershell
cd guardtrak-api
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST.rlwy.net:PORT/railway?sslmode=require"
npx prisma migrate deploy
npx prisma db seed
```

Then set the API **Start Command** (or use `railway.toml` / Dockerfile) to:

```bash
npx prisma migrate deploy && node dist/src/main.js
```

Seed creates org `GUARDTRAK` and users like `OFF-001` / `FOLPS!Dev2026`.

---

## Mode B — Production

```env
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@DB_HOST:5432/guardtrak?schema=public
JWT_ACCESS_SECRET=<long-random>
JWT_REFRESH_SECRET=<long-random>
STORAGE_PROVIDER=s3   # or r2
STORAGE_BUCKET=...
STORAGE_REGION=...
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
REDIS_ENABLED=true
REDIS_URL=redis://127.0.0.1:6379
AUTH_ALLOW_DEV_OTP_OUTPUT=false
AUTH_NEW_DEVICE_AUTO_APPROVE=false
TRUST_PROXY=true
COMPRESSION_ENABLED=true
CORS_ORIGINS=https://app.example.com
WS_CORS_ORIGINS=https://app.example.com
ENABLE_SWAGGER=false
```

Run with PM2: `pm2 start ecosystem.config.cjs --env production`.

---

## Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `NODE_ENV` | yes | `development`, `staging`, `production`, `test` |
| `PORT` | no | default `3000` |
| `API_PREFIX` | no | default `api/v1` |
| `DATABASE_URL` | yes | PostgreSQL connection string (local PG 18 in Mode A) |
| `JWT_ACCESS_SECRET` | yes* | placeholder allowed only in development/test |
| `JWT_REFRESH_SECRET` | yes* | placeholder allowed only in development/test |
| `JWT_ACCESS_EXPIRES_IN` | no | default `15m` |
| `JWT_REFRESH_EXPIRES_IN` | no | default `7d` / `30d` per example |
| `JWT_ISSUER` / `JWT_AUDIENCE` | no | defaults `guardtrak-api` / `guardtrak-clients` |
| `CORS_ORIGINS` | no | comma-separated origins |
| `LOG_LEVEL` | no | default `log` |
| `RATE_LIMIT_TTL` | no | milliseconds, default `60000` |
| `RATE_LIMIT_LIMIT` | no | default `100` |
| `STORAGE_PROVIDER` | no | `local`, `s3`, `minio`, `r2` — use `local` in Mode A |
| `STORAGE_BUCKET` | conditional | required for non-local in staging/production |
| `STORAGE_REGION` | no | |
| `STORAGE_ENDPOINT` | no | MinIO / R2 endpoint |
| `STORAGE_ACCESS_KEY` | conditional | required for non-local in staging/production |
| `STORAGE_SECRET_KEY` | conditional | required for non-local in staging/production |
| `STORAGE_PUBLIC_URL` | no | |
| `STORAGE_SIGNED_URL_TTL_SECONDS` | no | default `900` |
| `STORAGE_LOCAL_ROOT` | no | Mode A default `./storage` |
| `MAX_IMAGE_SIZE_BYTES` | no | default 10MB |
| `MAX_VIDEO_SIZE_BYTES` | no | default 100MB |
| `ENABLE_SWAGGER` | no | overrides default Swagger enablement |

## Auth / domain

| Variable | Required | Notes |
|----------|----------|-------|
| `AUTH_MAX_FAILED_ATTEMPTS` | no | default `5` |
| `AUTH_LOCKOUT_MINUTES` | no | default `15` |
| `AUTH_PASSWORD_RESET_OTP_EXPIRES_MINUTES` | no | default `10` |
| `AUTH_PASSWORD_RESET_MAX_ATTEMPTS` | no | default `5` |
| `AUTH_RESET_TOKEN_EXPIRES_MINUTES` | no | default `15` |
| `AUTH_ALLOW_DEV_OTP_OUTPUT` | no | **false** in production |
| `AUTH_NEW_DEVICE_AUTO_APPROVE` | no | **false** in production |
| `SHIFT_*` / `ATTENDANCE_*` / `PATROL_*` | no | see `.env.example` |
| `INCIDENT_*` / `EMERGENCY_*` / `SYNC_*` | no | idempotency TTLs |

## Infrastructure (Phase 8)

| Variable | Required | Notes |
|----------|----------|-------|
| `REDIS_ENABLED` | no | default `false`; Mode A typically false |
| `REDIS_URL` | no | default `redis://localhost:6379` |
| `REDIS_KEY_PREFIX` | no | default `guardtrak:` |
| `QUEUE_ENABLED` | no | default `true` (in-memory if no Redis) |
| `QUEUE_CONCURRENCY` | no | default `2` |
| `FCM_ENABLED` | no | default `false` |
| `FCM_PROJECT_ID` / `FCM_CLIENT_EMAIL` / `FCM_PRIVATE_KEY` | conditional | when FCM enabled |
| `APNS_*` | conditional | when APNs enabled |
| `EMAIL_ENABLED` | no | default `false` |
| `EMAIL_PROVIDER` | no | `smtp`, `resend`, `ses` |
| `SMTP_*` | conditional | when email smtp enabled |
| `EMAIL_RESEND_API_KEY` / `AWS_SES_REGION` | conditional | placeholders |
| `WS_ENABLED` | no | default `true` |
| `WS_CORS_ORIGINS` | no | Socket.IO origins |
| `METRICS_ENABLED` | no | default `true` |
| `TRUST_PROXY` | no | **true** behind Nginx |
| `COMPRESSION_ENABLED` | no | default `true` |

## Enterprise hardening (Phase 9)

| Variable | Required | Notes |
|----------|----------|-------|
| `AUTH_PASSWORD_HISTORY_COUNT` | no | default `5` — prior hashes blocked on change |
| `AUTH_PASSWORD_MAX_AGE_DAYS` | no | default `0` (disabled); when >0 forces `mustChangePassword` |
| `AUTH_STRICT_FINGERPRINT` | no | default `false`; when true, refresh rejects fingerprint mismatch |
| `STORAGE_ORG_QUOTA_BYTES` | no | optional org-level default quota (override per org in DB) |

Production template: [production.env.example](./production.env.example).

\* Staging/production reject placeholder JWT secrets containing markers such as `change-me`.

## Database URL format

```text
postgresql://USER:PASSWORD@localhost:5432/guardtrak?schema=public
```

Compatible with local PostgreSQL 18 and production Postgres 16+.
