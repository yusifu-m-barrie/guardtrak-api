# Redis

Redis backs caching, idempotency keys, distributed locks, BullMQ queues, and optional Socket.IO adapter scaling.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_ENABLED` | `false` | When `false`, an in-memory fallback is used |
| `REDIS_URL` | `redis://localhost:6379` | Connection URL |
| `REDIS_KEY_PREFIX` | `guardtrak:` | Key namespace prefix |

## Development

Redis is optional. With `REDIS_ENABLED=false`, the API runs without Redis using an in-process fallback suitable for local work and CI (`REDIS_ENABLED=false` in GitHub Actions).

Enable Redis locally:

```bash
docker compose up -d redis
```

Set `REDIS_ENABLED=true` and `REDIS_URL=redis://localhost:6379`.

## Production

Run Redis 7+ with persistence (`appendonly yes`), password/TLS as required, and restrict network access to the API and workers only. Production Compose (`docker-compose.production.yml`) includes Redis with a named volume.

## Health

When Redis is enabled, connection failures fall back to memory with a warning log. Monitor Redis memory and eviction policy in production.
