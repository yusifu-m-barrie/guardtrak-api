# Railway deployment — GuardTrak API

You already have Postgres on Railway (Variables tab shows `DATABASE_URL`,
`PGHOST`, `PGUSER`, `PGPASSWORD`, etc.). Deploy the API in the **same Railway
project** and reference that Postgres service.

## 1) Create the API service

1. Railway → your project → **New** → **GitHub Repo**
2. Select `guardtrak-api` (`https://github.com/yusifu-m-barrie/guardtrak-api.git`)
3. Root directory: repo root (where `Dockerfile` + `railway.toml` live)
4. Railway will use:
   - Builder: `Dockerfile` (`railway.toml`)
   - Start: `npx prisma migrate deploy && node dist/src/main.js`
   - Healthcheck: `GET /api/v1/health/live`

## 2) Connect Postgres (critical)

On the **API service → Variables**:

1. Click **Add Variable** → **Add Reference**
2. Choose your **Postgres** service
3. Select **`DATABASE_URL`** (private / internal) — **not** `DATABASE_PUBLIC_URL`

This is the preferred live setting:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

### Why not localhost / public URL?

| Source | Use? |
|--------|------|
| `localhost:5432` | ❌ Never on Railway |
| Postgres `DATABASE_URL` (private) | ✅ Yes — same project |
| Postgres `DATABASE_PUBLIC_URL` | Only if API is outside Railway; needs TLS |

You do **not** need to copy `PGHOST` / `PGUSER` / `PGPASSWORD` separately if
`DATABASE_URL` is referenced — that URL already contains them.

## 3) Set required production variables

Open `docs/railway.env.example` and paste into Railway Variables.

**Must set / generate before first successful boot:**

| Variable | Notes |
|----------|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Variable reference to Postgres |
| `JWT_ACCESS_SECRET` | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | Different random value |
| `TRUST_PROXY` | `true` (required behind Railway) |
| `AUTH_ALLOW_DEV_OTP_OUTPUT` | `false` |
| `AUTH_NEW_DEVICE_AUTO_APPROVE` | `false` |
| `CORS_ORIGINS` | Your live dashboard URL(s), comma-separated |
| `WS_CORS_ORIGINS` | Same as CORS (or matching WS origins) |
| `STORAGE_PROVIDER` | `local` for first demo |
| `STORAGE_ALLOW_EPHEMERAL` | `true` for first demo on Railway disk |

Generate JWT secrets (PowerShell):

```powershell
openssl rand -base64 48
openssl rand -base64 48
```

## 4) Networking / public URL

1. API service → **Settings** → **Networking** → **Generate Domain**
2. Copy the public URL (example: `https://guardtrak-api-production.up.railway.app`)
3. Health check: `https://YOUR-API-DOMAIN/api/v1/health/live`
4. API base path: `https://YOUR-API-DOMAIN/api/v1`

## 5) Dashboard / mobile CORS

Update API variables after the dashboard has a live URL:

```env
CORS_ORIGINS=https://your-dashboard.vercel.app,https://app.yourdomain.com
WS_CORS_ORIGINS=https://your-dashboard.vercel.app,https://app.yourdomain.com
```

Then set the dashboard’s `NEXT_PUBLIC_API_URL` (or backend proxy target) to:

```text
https://YOUR-API-DOMAIN/api/v1
```

## 6) First deploy checklist

- [ ] API and Postgres are in the **same** Railway project
- [ ] `DATABASE_URL` is a **reference** to Postgres `DATABASE_URL`
- [ ] JWT secrets are real (not `change-me`)
- [ ] `TRUST_PROXY=true`
- [ ] Dev auth flags are `false`
- [ ] Deploy succeeds and `/api/v1/health/live` returns healthy
- [ ] Optional: seed data from Railway shell:

```bash
npm run prisma:seed
```

## 7) Common deploy errors

| Error / symptom | Fix |
|-----------------|-----|
| `JWT_ACCESS_SECRET must be set to a non-placeholder` | Replace secrets |
| `AUTH_ALLOW_DEV_OTP_OUTPUT must be disabled` | Set `false` |
| `STORAGE_PROVIDER=local is not allowed` | Set `STORAGE_ALLOW_EPHEMERAL=true` or use S3/R2 |
| `TRUST_PROXY must be true` | Set `TRUST_PROXY=true` |
| DB connection refused / timeout | Use private `DATABASE_URL` reference; ensure services share a project |
| Migrate fails | Confirm `DATABASE_URL` is present at runtime; check Postgres is running |
| CORS blocked in browser | Add dashboard origin to `CORS_ORIGINS` |

## Storage note

Container disk is **ephemeral**. Local storage is fine for first smoke tests only.
For durable evidence/selfies, switch to `STORAGE_PROVIDER=s3` or `r2` and remove
`STORAGE_ALLOW_EPHEMERAL`.

## Redis note

Single API replica: `REDIS_ENABLED=false` is OK (in-memory queue fallback).
Add Railway Redis + `REDIS_ENABLED=true` before scaling to multiple replicas.
