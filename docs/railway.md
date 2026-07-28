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

## Fix for empty DATABASE_URL (current failure)

If deploy logs show:

```text
DATABASE_URL (or DATABASE_PUBLIC_URL) is required
```

the API service has **no database URL injected**. Fix it in Railway UI:

### Option A (recommended, fastest)

1. Open **Postgres** service → **Variables**
2. Click the **eye** on `DATABASE_PUBLIC_URL`, then **Copy**
3. Open **API** service → **Variables**
4. Add/Edit `DATABASE_URL`
5. Paste the copied public URL value (raw connection string)
6. Redeploy API

### Option B (Variable Reference)

1. Open **API** service → **Variables**
2. **+ New Variable** → **Add Reference**
3. Service: your Postgres service (exact name in Railway)
4. Variable: `DATABASE_PUBLIC_URL`
5. Make sure the variable name on the API side is `DATABASE_URL`
6. Redeploy

Important:
- References only work when both services are in the **same project + same environment**
- Pasting the literal text `${{Postgres.DATABASE_URL}}` as a normal string does **not** resolve unless created as a Railway **Reference**
- Never use `localhost`

On the **API service → Variables**:

1. Click **Add Variable** → **Add Reference**
2. Choose your **Postgres** service
3. Prefer **`DATABASE_URL`** (private / internal)

Also add a second reference for fallback:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
DATABASE_PUBLIC_URL=${{Postgres.DATABASE_PUBLIC_URL}}
```

The boot script (`scripts/railway-start.sh`) will:
1. Try private `DATABASE_URL` first
2. If `postgres.railway.internal` is unreachable, automatically switch to `DATABASE_PUBLIC_URL`
3. Retry migrations before starting Nest

### If healthcheck still fails with P1001

Force the public URL on the API service:

```env
USE_DATABASE_PUBLIC_URL=true
DATABASE_PUBLIC_URL=${{Postgres.DATABASE_PUBLIC_URL}}
DATABASE_URL=${{Postgres.DATABASE_PUBLIC_URL}}
```

Also verify:
- API and Postgres are in the **same Railway project and environment**
- Postgres service is **Running** (not paused)
- You did **not** hardcode `localhost`

### Why not localhost / public URL?

| Source | Use? |
|--------|------|
| `localhost:5432` | ❌ Never on Railway |
| Postgres `DATABASE_URL` (private) | ✅ Preferred when private networking works |
| Postgres `DATABASE_PUBLIC_URL` | ✅ Fallback / force when private DNS fails |

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
| DB connection refused / timeout / `P1001` `postgres.railway.internal` | Add `DATABASE_PUBLIC_URL` reference and set `USE_DATABASE_PUBLIC_URL=true` (or set `DATABASE_URL` to public URL). Confirm Postgres is Running in same environment. |
| Migrate fails | Confirm `DATABASE_URL` is present at runtime; check Postgres is running |
| CORS blocked in browser | Add dashboard origin to `CORS_ORIGINS` |

## Storage note

Container disk is **ephemeral**. Local storage is fine for first smoke tests only.
For durable evidence/selfies, switch to `STORAGE_PROVIDER=s3` or `r2` and remove
`STORAGE_ALLOW_EPHEMERAL`.

## Redis note

Single API replica: `REDIS_ENABLED=false` is OK (in-memory queue fallback).
Add Railway Redis + `REDIS_ENABLED=true` before scaling to multiple replicas.
