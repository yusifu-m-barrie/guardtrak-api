# Performance Guide (Phase 9)

Practices for responsive GuardTrak API under load. **Mode A** development does not require Redis; production (**Mode B**) should enable Redis, compression, and connection pooling.

Related: [scaling-guide.md](./scaling-guide.md), [redis.md](./redis.md), [database-indexes.md](./database-indexes.md).

---

## Caching

`CacheService` (Phase 9) provides JSON-friendly get/set with TTL:

- **Redis** when `REDIS_ENABLED=true` — shared across PM2 instances.
- **In-memory** fallback — single-process only; fine for Mode A.

Guidelines:

- Cache read-heavy aggregates (dashboard counts, FAQ lists) with short TTL (30–300s).
- Use namespaced keys: `reports:dashboard:{orgId}`.
- Invalidate on writes via `del` or `clearPrefix('reports:')`.
- Monitor hit ratio via `GET /api/v1/admin/cache`.

Avoid caching user-specific auth tokens or PII blobs.

---

## Compression

`COMPRESSION_ENABLED=true` (default) enables gzip/deflate on responses via `compression` middleware in `main.ts`.

Most effective for JSON list endpoints and report payloads. Binary uploads use presigned URLs — compression does not apply to S3/R2 transfers.

---

## Pagination

All list endpoints should use shared pagination:

- Query: `page` (default 1), `limit` (default 20, max 100).
- Utility: `normalisePagination()` in `src/common/utils/pagination.util.ts`.
- Response: `meta.page`, `meta.limit`, `meta.total`, `meta.totalPages`.

**Tips:**

- Prefer indexed filters (`organisationId`, `status`, `createdAt`) in `WHERE`.
- Avoid `OFFSET` deep pages for very large tables — consider cursor-based pagination in future high-volume lists.
- Never return unbounded relations; use explicit `select` / `include`.

---

## Prisma tips

1. **Select only needed fields** — large user/officer payloads add latency.
2. **Use transactions** for multi-row writes (already used in assignments, patrols).
3. **Index alignment** — see [database-indexes.md](./database-indexes.md); add composite indexes for hot list queries.
4. **Connection pool** — default Prisma pool is per process; use PgBouncer at scale ([scaling-guide.md](./scaling-guide.md)).
5. **N+1 avoidance** — batch `findMany` with `where: { id: { in: ids } }` instead of loops.
6. **Raw counts** — `count()` with same filter as list query for accurate `meta.total`.
7. **Soft deletes** — always filter `deletedAt: null` to keep scans narrow.

---

## Evidence and storage

- Presigned uploads offload bandwidth from API.
- Enforce `MAX_IMAGE_SIZE_BYTES` / `MAX_VIDEO_SIZE_BYTES` before issuing URLs.
- Thumbnail and virus scan run asynchronously via queues.
- Track `storageUsedBytes` to prevent runaway org usage.

---

## Queues and async work

Move slow work off the request path:

- Email, push, evidence processing, reports, cleanup.
- Tune `QUEUE_CONCURRENCY` (default 2) per worker VM size.

---

## Observability

- `MetricsInterceptor` records per-route latency histograms.
- Watch p95 on `/auth/login`, `/sync/batch`, `/attendance/clock-in`.
- Phase 9: `recordDomain(domain, action)` for business counters.

---

## Development profiling

Mode A:

```bash
npm run start:dev
# Hit endpoint, watch query logs with LOG_LEVEL=debug if needed
```

Use `EXPLAIN ANALYZE` on slow Postgres queries directly against local PG 18.
