# Recovery Guide

Disaster recovery for GuardTrak API with **PostgreSQL 18** (local or managed). Docker is optional and not required.

Related: [postgresql-backup.md](./postgresql-backup.md), [postgresql-restore.md](./postgresql-restore.md), [deployment.md](./deployment.md), [operations-manual.md](./operations-manual.md).

---

## RTO / RPO targets (guidance)

| Tier | RPO | RTO | Notes |
|------|-----|-----|-------|
| Dev / staging | Best effort | < 2h | Local dumps + seed |
| Production | ≤ 24h (daily dump) | ≤ 4h | Add PITR / managed backups for tighter RPO |

---

## Restore checklist

1. Stop writers (API / PM2 / queue workers) or put the app in maintenance.
2. Restore database from the latest verified dump (`scripts/restore-database.ps1` / `.sh`).
3. Restore object storage (local folder or S3/R2 bucket copy) if evidence was lost.
4. Confirm `npx prisma migrate status` shows applied migrations.
5. Start API; hit `/api/v1/health/ready` and `/api/v1/health/live`.
6. Smoke: login, clock-in, incident list, evidence download URL.
7. Clear application cache via `POST /api/v1/admin/cache/clear` (SUPER_ADMIN) if stale data appears.
8. Resume queues (`POST /api/v1/admin/queues/resume`).

---

## Rollback checklist

1. Identify last known-good deploy tag / commit.
2. Revert application binary/config only if schema is compatible; otherwise restore DB + app together.
3. Prefer forward-fix migrations over destructive down migrations in production.
4. Document the incident in ops notes; retain failed dumps for forensics.

---

## Zero-downtime notes

- Prefer rolling PM2/Nginx reloads with drain.
- Run Prisma migrations that are additive before deploying code that depends on them.
- Avoid long exclusive locks; use online-safe index creation where possible.
