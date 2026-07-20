# Scaling Guide (Phase 9)

Capacity planning for GuardTrak officer workloads. Assumes PostgreSQL 16+, Redis in production, S3/R2 evidence storage, PM2 or container replicas behind Nginx.

**Mode A** (single dev machine) does not require this table — use it for production sizing only.

---

## Officer scale reference

Approximate **single-region** targets with one API worker (2 vCPU, 4 GB RAM), managed Postgres, Redis, and object storage. Adjust ±30% based on patrol frequency, evidence volume, and sync batch size.

| Active officers | API instances | Postgres | Redis | Queue workers | WebSocket | Notes |
|-----------------|---------------|----------|-------|---------------|-----------|-------|
| **5k** | 1–2 | 2 vCPU, 8 GB, 100 GB SSD | 1 GB | 1 (shared or sidecar) | Single instance OK | PgBouncer optional |
| **10k** | 2–3 | 4 vCPU, 16 GB | 2 GB | 2 | Redis adapter + 2 API nodes | Read replica for reports |
| **25k** | 4–6 | 8 vCPU, 32 GB | 4 GB | 3–4 | 4 nodes + sticky LB | Dedicated report worker |
| **50k** | 8–12 | 16 vCPU, 64 GB + replica | 8 GB cluster | 6+ | Horizontal WS fleet | Partition audit archival |
| **100k** | 15–25 | Primary + 2 read replicas | Redis Cluster | 10+ | Separate WS tier | Multi-AZ, sharded orgs |

---

## PostgreSQL

| Technique | When |
|-----------|------|
| **PgBouncer** (transaction mode) | >10k officers or >50 API connections |
| **Read replicas** | Reporting, admin aggregates, heavy list APIs |
| **Connection limit** | `pool_size` × API instances ≤ Postgres `max_connections` |
| **Indexes** | Review [database-indexes.md](./database-indexes.md) each phase |
| **Vacuum / analyze** | Weekly; monitor bloat on `audit_logs`, `attendance_events` |

Local development: PostgreSQL **18** on localhost — no PgBouncer required.

---

## Redis

| Scale | Setup |
|-------|-------|
| <10k | Single Redis 7 instance |
| 10k–50k | Redis with persistence (AOF); separate DB index for BullMQ |
| >50k | Redis Cluster or Elasticache; key prefix `REDIS_KEY_PREFIX` |

Used for: BullMQ, optional cache, Socket.IO adapter (multi-instance).

`REDIS_ENABLED=false` uses in-memory fallback — **not** for production multi-instance.

---

## Queues

- Scale **horizontally** by running worker processes/containers with same `REDIS_URL`.
- Increase `QUEUE_CONCURRENCY` only after CPU headroom confirmed.
- Monitor failed jobs and DLQ via admin metrics.
- Cleanup jobs (sessions, OTP, devices) prevent table bloat — see [maintenance-guide.md](./maintenance-guide.md).

---

## Object storage

Evidence scales with **S3/R2**, not API disk:

| Scale | Pattern |
|-------|---------|
| Any | Presigned PUT/GET; CDN optional for downloads |
| High volume | Lifecycle rules (IA/Glacier for old evidence) |
| Quotas | `storageQuotaBytes` per org |

Mode A `STORAGE_PROVIDER=local` does not scale — use cloud storage in Mode B.

---

## WebSockets (`/realtime`)

| Instances | Requirement |
|-----------|-------------|
| 1 | No Redis adapter required |
| 2+ | Redis adapter + sticky sessions **or** shared room state |

Nginx: upgrade headers configured in `deploy/nginx/guardtrak-api.conf`.

---

## API layer

- **PM2 fork** (default) or Docker replicas behind load balancer.
- **Rate limits** — tune `RATE_LIMIT_*` per edge capacity.
- **Compression** — keep enabled at Nginx or app layer, not both aggressively.
- **Health** — LB should use `/api/v1/health/ready`.

---

## What not to scale first

- Do not add API replicas before Postgres and Redis are sized.
- Do not run multiple WS nodes without Redis adapter.
- Do not expose Postgres/Redis publicly — always private network.

See [production-architecture.md](./production-architecture.md) and [deployment.md](./deployment.md).
