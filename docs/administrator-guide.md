# Administrator Guide — Platform Admin API

SUPER_ADMIN endpoints for platform operators. Tenant **ADMINISTRATOR** users (`ADM-001`, etc.) manage their organisation via `/api/v1/users`, `/api/v1/devices`, etc. — **not** these routes.

Base path: `/api/v1/admin`

---

## Authentication

Login with platform credentials (seed development account):

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "organisationCode": "PLATFORM",
  "employeeId": "SUPER-ADMIN",
  "password": "<password>",
  "installationId": "ops-console-001",
  "platform": "WEB"
}
```

Use the returned `accessToken` on all admin requests:

```http
Authorization: Bearer <accessToken>
```

Required role: `SUPER_ADMIN`. Required permission: `platform:manage` (and Phase 9 `admin:system:read` / `admin:system:manage`).

Non–super-admin tokens receive `403` with `AUTH_INSUFFICIENT_ROLE` or `AUTH_INSUFFICIENT_PERMISSION`.

---

## Endpoints

### GET `/admin/system`

Runtime snapshot for support and monitoring.

**Response data (typical):**

- `nodeEnv`, `uptimeSeconds`
- `versions` — Node, application
- `redis` — `up` | `down` | `memory`
- `queueBackend` — `redis` | `memory`

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:3000/api/v1/admin/system | jq .
```

---

### GET `/admin/system-health`

Same dependency checks as public health, formatted for operators (database, Redis, readiness).

---

### GET `/admin/metrics`

JSON summary of key counters (HTTP, queues, storage, cache, memory). For Prometheus text, use public `GET /api/v1/metrics` when enabled.

---

### GET `/admin/cache`

```json
{
  "backend": "redis",
  "keys": 42,
  "hits": 1200,
  "misses": 80
}
```

`backend: "memory"` when `REDIS_ENABLED=false` (Mode A).

---

### POST `/admin/cache/clear`

Clears application cache. **Mutating** — records `ADMIN_ACTION` / `CACHE_CLEAR` audit.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:3000/api/v1/admin/cache/clear
```

Use sparingly in production; prefer TTL expiry for normal operation.

---

### GET `/admin/storage`

Aggregates evidence `sizeBytes` and samples organisations with `storageQuotaBytes` / `storageUsedBytes`.

Useful before enforcing `STORAGE_ORG_QUOTA_BYTES` or investigating quota errors (`STORAGE_QUOTA_EXCEEDED`).

---

### GET `/admin/queues`

Returns `JobsService.getMetrics()` — per-queue counts when Redis backend is active; `{ backend: "memory", queues: {} }` in Mode A.

---

### POST `/admin/queues/pause` · POST `/admin/queues/resume`

Placeholder controls for worker pause/resume. Logs action; does not crash in-memory mode. Audited as `ADMIN_ACTION`.

---

### POST `/admin/queues/retry`

Enqueues a cleanup/retry task (e.g. DLQ retry). Audited as `QUEUE_RETRY`.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"task":"retry-dlq"}' \
  http://127.0.0.1:3000/api/v1/admin/queues/retry
```

---

### GET `/admin/background-jobs`

Lists registered queue names and known job types from `queue.names` (notifications, emails, evidence, cleanup jobs including `refresh-token-cleanup`, `expired-sessions`, etc.).

---

## Audit trail

Mutating admin actions are written to `audit_logs` via `AuthAuditService`:

| Action | When |
|--------|------|
| `ADMIN_ACTION` | Pause/resume and other admin mutations |
| `CACHE_CLEAR` | Cache cleared |
| `QUEUE_RETRY` | Queue retry triggered |

Include `requestId` from responses when escalating to engineering.

---

## Security notes

- Restrict SUPER_ADMIN accounts; never assign via tenant user APIs.
- Do not expose admin routes through public docs in production (`ENABLE_SWAGGER=false`).
- Prefer IP allow-lists or VPN for ops consoles in production.
- Rotate platform credentials independently of tenant admins.

See [security-guide.md](./security-guide.md) and [tenant-scoping.md](./tenant-scoping.md).
