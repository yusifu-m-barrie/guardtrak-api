# Operations Manual (Phase 9)

Day-2 operations for GuardTrak API. **Mode A:** local PostgreSQL 18 + `npm run start:dev`. **Mode B:** PM2 on Ubuntu/VPS (Docker optional).

Related: [deployment.md](./deployment.md), [monitoring.md](./monitoring.md), [administrator-guide.md](./administrator-guide.md), [maintenance-guide.md](./maintenance-guide.md).

---

## Process management (PM2)

Primary production runtime: [`ecosystem.config.cjs`](../ecosystem.config.cjs).

```bash
pm2 status
pm2 logs guardtrak-api --lines 200
pm2 reload ecosystem.config.cjs --env production
pm2 stop guardtrak-api
```

After deploy: `npm ci && npx prisma generate && npm run build && npx prisma migrate deploy && pm2 reload ...`

Keep `instances: 1` unless Redis adapter + sticky sessions are configured for WebSockets.

---

## Health checks

| Endpoint | Use | Expected |
|----------|-----|----------|
| `GET /api/v1/health/live` | Liveness (no DB) | Always `200` if process up |
| `GET /api/v1/health` | Full check | `200` or `503` (DB + Redis) |
| `GET /api/v1/health/ready` | Load balancer / K8s | `200` when DB + Redis ready |

```bash
curl -fsS http://127.0.0.1:3000/api/v1/health/live
curl -fsS http://127.0.0.1:3000/api/v1/health/ready
```

Mode A with `REDIS_ENABLED=false`: Redis reports `memory` — still **ready**.

---

## Metrics

Public scrape endpoint when `METRICS_ENABLED=true`:

```bash
curl -fsS http://127.0.0.1:3000/api/v1/metrics
```

Counters include HTTP requests, queue jobs, storage ops, push attempts, audit events, cache hit/miss (Phase 9), and process memory.

SUPER_ADMIN summary: `GET /api/v1/admin/metrics` (JSON envelope). See [administrator-guide.md](./administrator-guide.md).

---

## Queues

Background work via BullMQ when `REDIS_ENABLED=true`, else in-memory fallback.

| Queue | Purpose |
|-------|---------|
| `notifications` | Push delivery |
| `emails` | Transactional email |
| `evidence` | Post-upload processing |
| `thumbnails` | Thumbnail generation (stub) |
| `reports` | Report generation |
| `cleanup` | Session/token/device maintenance |
| `sync-retries` | Offline sync retries |
| `expired-uploads` | Abandoned upload cleanup |

Inspect via admin API: `GET /api/v1/admin/queues`, `GET /api/v1/admin/background-jobs`.

Operational actions (SUPER_ADMIN):

- `POST /api/v1/admin/queues/retry` — re-enqueue DLQ / retry task
- `POST /api/v1/admin/queues/pause` / `resume` — placeholders; safe on in-memory backend

See [bullmq-queues.md](./bullmq-queues.md).

---

## Cache

Application cache (`CacheService`): Redis when available, in-memory Map otherwise.

| Admin endpoint | Action |
|----------------|--------|
| `GET /api/v1/admin/cache` | Hit/miss stats, backend type |
| `POST /api/v1/admin/cache/clear` | Clear cache; audits `CACHE_CLEAR` |

Use after bulk data fixes or suspected stale aggregates. Not a substitute for Redis FLUSHDB — only app-prefixed keys.

---

## Admin endpoints overview

All under `/api/v1/admin/*` — **SUPER_ADMIN** only (`platform:manage`).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/system` | Runtime info (env, uptime, Redis, queue backend) |
| GET | `/admin/system-health` | HealthService aggregate |
| GET | `/admin/metrics` | Metrics summary |
| GET | `/admin/cache` | Cache stats |
| POST | `/admin/cache/clear` | Clear application cache |
| GET | `/admin/storage` | Evidence totals + org quota sample |
| GET | `/admin/queues` | Queue metrics |
| POST | `/admin/queues/pause` | Pause workers (placeholder) |
| POST | `/admin/queues/resume` | Resume workers (placeholder) |
| POST | `/admin/queues/retry` | Retry failed / DLQ jobs |
| GET | `/admin/background-jobs` | Known queues and job types |

Full usage: [administrator-guide.md](./administrator-guide.md).

---

## Backups

Database (local PG 18 or production):

```powershell
.\scripts\backup-database.ps1
```

```bash
./scripts/backup-database.sh
```

Local storage (Mode A evidence files):

```powershell
.\scripts\backup-storage.ps1
```

Schedule daily Postgres dumps; retain 14+ days off-server. See [postgresql-backup.md](./postgresql-backup.md).

---

## Logs and incidents

- **Request correlation:** every response includes `requestId`.
- **PM2 logs:** `logs/pm2-out.log`, `logs/pm2-error.log`.
- **Audit trail:** `audit_logs` table; auth events via `AuthAuditService`.

On 5xx spike: check `/health/ready`, Postgres connections, Redis, queue depth, disk on `STORAGE_LOCAL_ROOT` or S3/R2.

---

## Mode A quick reference

```bash
cd guardtrak-api
npm run start:dev
curl http://127.0.0.1:3000/api/v1/health/live
```

No Docker required. Redis optional.
