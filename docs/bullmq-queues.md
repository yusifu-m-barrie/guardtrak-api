# BullMQ Queues

Background jobs (email send, push delivery, report generation) use BullMQ when `QUEUE_ENABLED=true`.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `QUEUE_ENABLED` | `true` | Master switch for queue workers |
| `QUEUE_CONCURRENCY` | `2` | Parallel job handlers per worker process |

## Requirements

- BullMQ requires Redis. Enable `REDIS_ENABLED=true` in staging/production when using queues.
- With Redis disabled, queue registration may defer or no-op depending on module wiring; CI runs with `REDIS_ENABLED=false` and `QUEUE_ENABLED=true` for smoke coverage.

## Operations

- Scale workers by running additional API/worker containers pointed at the same `REDIS_URL`.
- Failed jobs should be monitored via Redis/BullMQ tooling or application logs.
- Graceful shutdown: NestJS `enableShutdownHooks()` allows in-flight jobs to complete where supported.

See [redis.md](./redis.md) and [monitoring.md](./monitoring.md).
