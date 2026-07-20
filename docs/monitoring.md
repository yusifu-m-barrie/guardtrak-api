# Monitoring

Observability for GuardTrak API in staging and production. **Mode A:** local PostgreSQL 18 + `npm run start:dev` — health and metrics work without Docker.

## Health endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/health/live` | Liveness — process up, no dependency checks |
| `GET /api/v1/health` | Liveness + DB + Redis status (200 or 503) |
| `GET /api/v1/health/ready` | Readiness probe for orchestrators |

Docker and Compose healthchecks use these paths. Load balancers should use `/health/ready` for routing decisions.

SUPER_ADMIN aggregate: `GET /api/v1/admin/system-health` (see [administrator-guide.md](./administrator-guide.md)).

## Metrics

When `METRICS_ENABLED=true`, the API exposes request metrics at `GET /api/v1/metrics` (Prometheus-style text).

### HTTP metrics

| Metric | Type | Labels |
|--------|------|--------|
| `http_requests_total` | counter | `method`, `route`, `status` |
| `http_request_duration_ms` | histogram | `method`, `route` |

### Infrastructure metrics

| Metric | Type | Labels |
|--------|------|--------|
| `queue_jobs_total` | counter | `queue`, `status` (`completed`, `failed`, `dead_letter`) |
| `storage_ops_total` | counter | `operation`, `status` |
| `notification_push_total` | counter | `status` (`sent`, `failed`, `skipped`) |
| `audit_events_total` | counter | `action` |

### Phase 9 domain metrics

| Metric | Type | Labels |
|--------|------|--------|
| `domain_events_total` | counter | `domain`, `action` — business events via `MetricsService.recordDomain` |
| `cache_requests_total` | counter | `result` (`hit`, `miss`) |
| `redis_health_total` | counter | `status` |
| `process_resident_memory_bytes` | gauge | RSS from `process.memoryUsage()` |

Disable public scrape in constrained environments with `METRICS_ENABLED=false`. SUPER_ADMIN JSON summary: `GET /api/v1/admin/metrics`.

## Logging

- Structured request logging via the logging interceptor (`LOG_LEVEL` controls Nest logger verbosity).
- Every response includes a `requestId` for correlation.
- Ship container stdout to your log aggregator (e.g. Hostinger logs, Loki, CloudWatch).

## Alerts (recommended)

- API readiness failing for > 2 minutes
- Postgres connection errors
- Redis down when `REDIS_ENABLED=true`
- Queue depth / failed BullMQ jobs
- 5xx rate spike
- Disk usage on object storage and DB volumes
- Cache miss ratio sustained high (optional)
- `AUTH_REFRESH_REUSED` / `SECURITY_EVENT` audit spike (token theft indicator)

## Uptime checks

External monitor (UptimeRobot, Better Stack, etc.):

- `GET https://api.example.com/api/v1/health/ready` every 1–5 minutes
- Optional authenticated smoke: login + `GET /auth/me`

## Docker

```bash
docker compose ps
docker compose logs -f api
```

Production (optional):

```bash
docker compose -f docker-compose.production.yml logs -f api --tail=200
```

See [production-architecture.md](./production-architecture.md), [deployment.md](./deployment.md), and [operations-manual.md](./operations-manual.md).
