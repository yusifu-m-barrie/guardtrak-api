# PostgreSQL backup guide

For **local PostgreSQL 18** (development) and production host/managed Postgres. Uses native `pg_dump` — not Docker.

## Prerequisites

- `pg_dump` on PATH (PostgreSQL 18 client tools)
- Credentials matching `DATABASE_URL` in `.env`

## Custom-format backup (recommended)

```bash
pg_dump "$DATABASE_URL" -Fc -f "guardtrak_$(date +%Y%m%d_%H%M%S).dump"
```

Discrete connection flags:

```bash
pg_dump -h localhost -p 5432 -U YOUR_USER -d guardtrak -Fc \
  -f "guardtrak_$(date +%Y%m%d_%H%M%S).dump"
```

Windows PowerShell:

```powershell
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
pg_dump -Fc -f "guardtrak_$stamp.dump" $env:DATABASE_URL
```

## Plain SQL backup (optional)

```bash
pg_dump "$DATABASE_URL" -Fp -f guardtrak.sql
```

Prefer `-Fc` for large databases and faster restore.

## Production schedule (Linux)

Daily 02:15 UTC, retain 14 days:

```bash
sudo mkdir -p /var/backups/guardtrak
sudo tee /etc/cron.d/guardtrak-pg <<'EOF'
15 2 * * * postgres pg_dump -Fc -f /var/backups/guardtrak/guardtrak_$(date +\%Y\%m\%d).dump guardtrak && find /var/backups/guardtrak -name '*.dump' -mtime +14 -delete
EOF
```

Copy dumps off-server (object storage, Hostinger backup, rclone).

## Before every production migrate

1. Take a fresh `-Fc` dump
2. Confirm file size > 0
3. Store a copy off-box
4. Then run `npx prisma migrate deploy`

## Related

- [postgresql-restore.md](./postgresql-restore.md)
- [deployment.md](./deployment.md)
- [deployment-checklist.md](./deployment-checklist.md)
