# Docker (optional)

**Docker is not required for development.** Mode A uses local **PostgreSQL 18** and `npm run start:dev`. See [deployment.md](./deployment.md).

Compose Postgres is gated behind profiles so it does **not** bind `:5432` by default and cannot conflict with local PostgreSQL 18.

## Profiles

| Profile | Services | When to use |
|---------|----------|-------------|
| _(none)_ | nothing | Mode A — no Docker |
| `optional-deps` | Redis, MinIO, Mailpit | Want sidecars; keep local PG 18 |
| `docker-db` | Postgres (+ Redis on parent compose) | CI / machines **without** local Postgres |
| `api` | API + Postgres + Redis + MinIO + Mailpit | Full container stack (optional) |

## Mode A — safe optional sidecars

```bash
# Repository root or guardtrak-api/
docker compose --profile optional-deps up -d
```

Then optionally:

```env
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
```

**Never** run `--profile docker-db` while local PostgreSQL 18 is using port 5432.

## Optional full container stack

```bash
cd guardtrak-api
docker compose --profile api up -d --build
```

This starts Compose Postgres on `:5432` — stop local PG first or change the published port.

## Production Compose (optional alternative to PM2)

```bash
docker compose -f docker-compose.production.yml up -d --build
```

Preferred production path remains **PM2 + host/managed Postgres** ([deployment.md](./deployment.md)).

## Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage Node 22 image |
| `.dockerignore` | Build context exclusions |
| `docker-compose.yml` | Optional profiles (above) |
| `docker-compose.production.yml` | Optional prod stack |

## Migrations in containers

```bash
docker compose --profile api run --rm api npx prisma migrate deploy
```
