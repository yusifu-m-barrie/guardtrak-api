# PostgreSQL restore guide

Restores dumps created with [postgresql-backup.md](./postgresql-backup.md). Compatible with **local PostgreSQL 18** and production Postgres.

## Custom-format restore (`-Fc`)

Target database must already exist.

```bash
pg_restore -d "$DATABASE_URL" --clean --if-exists --no-owner --no-acl \
  guardtrak_YYYYMMDD_HHMMSS.dump
```

Discrete flags:

```bash
pg_restore -h localhost -p 5432 -U YOUR_USER -d guardtrak \
  --clean --if-exists --no-owner --no-acl \
  guardtrak_YYYYMMDD_HHMMSS.dump
```

`--clean --if-exists` drops existing objects before recreate. Use a scratch database first when testing.

## Plain SQL restore

```bash
psql "$DATABASE_URL" -f guardtrak.sql
```

## After restore (application)

```bash
cd guardtrak-api
npx prisma generate
npx prisma migrate deploy
```

**Development (Mode A):**

```bash
npm run start:dev
```

**Production (Mode B — PM2):**

```bash
pm2 reload ecosystem.config.cjs --env production
curl -fsS https://api.yourdomain.com/api/v1/health/ready
```

## Verify

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM organisations;"
curl -fsS http://127.0.0.1:3000/api/v1/health/ready
```

## Notes

- Evidence files in S3/R2 are **not** inside Postgres — restore object storage separately if needed
- Do not point Compose Postgres restore at Mode A local PG 18 unless you intentionally switched databases
- Always restore into a test DB before overwriting production

## Related

- [postgresql-backup.md](./postgresql-backup.md)
- [deployment-checklist.md](./deployment-checklist.md)
