# Railway deployment notes (GuardTrak API)

## Required production variables

Set these on the **API** service (not only in Dockerfile):

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Private Postgres URL (`*.railway.internal`) from the Postgres service |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Strong random secrets (not placeholders) |
| `TRUST_PROXY` | `true` (required — Railway terminates TLS at the edge) |
| `AUTH_ALLOW_DEV_OTP_OUTPUT` | `false` |
| `AUTH_NEW_DEVICE_AUTO_APPROVE` | `false` |
| `CORS_ORIGINS` / `WS_CORS_ORIGINS` | Real app origins (not localhost) |

## Storage on Railway

Container disk is **ephemeral**. Prefer `STORAGE_PROVIDER=s3` or `r2` with credentials.

For short demos only:

```env
STORAGE_PROVIDER=local
STORAGE_ALLOW_EPHEMERAL=true
```

Evidence will be lost on every redeploy when using local storage.

## Redis

Single replica can run with `REDIS_ENABLED=false` (in-memory fallback). Multi-instance or durable queues need Railway Redis + `REDIS_ENABLED=true`.

## Seeding

After migrate, seed from Railway shell:

```bash
npm run prisma:seed
```

(`tsx` is a production dependency so this works after `npm prune`.)

## Health

Railway / Docker liveness: `GET /api/v1/health/live`

## Devices

With `AUTH_NEW_DEVICE_AUTO_APPROVE=false`, new devices are created as `PENDING` and **login does not issue tokens** (`AUTH_DEVICE_PENDING`).

Approve for demo (Railway Postgres query or shell):

```sql
UPDATE "Device" SET status = 'ACTIVE', "trustedAt" = NOW() WHERE status = 'PENDING';
```

Or use admin device APIs (`PATCH /devices/:id/status` with `device:approve`).
