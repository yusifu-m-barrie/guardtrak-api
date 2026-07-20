# Maintenance Guide (Phase 9)

Scheduled upkeep, migrations, and zero-downtime notes for GuardTrak API.

Related: [postgresql-backup.md](./postgresql-backup.md), [postgresql-restore.md](./postgresql-restore.md), [database-migrations.md](./database-migrations.md), [operations-manual.md](./operations-manual.md).

---

## Cleanup jobs (background)

Enqueued on the `cleanup` queue (BullMQ or in-memory). Phase 9 job types include:

| Job | Purpose |
|-----|---------|
| `refresh-token-cleanup` | Remove expired/revoked refresh sessions |
| `expired-sessions` | `expiresAt < now` or revoked > 30 days |
| `otp-cleanup` | Expired password-reset OTP rows |
| `password-reset-cleanup` | Consumed/expired reset tokens |
| `inactive-devices` | `PENDING` devices older than 90 days → soft revoke |
| `incident-escalation` | Stub — future SLA escalation |
| `audit-cleanup` | Stub — archival per retention policy |
| `database-cleanup` | Stub — orphan row checks |
| `expired-uploads` | Abandoned presigned uploads |

Trigger manually via `POST /api/v1/admin/queues/retry` or schedule recurring enqueue from cron/worker.

**Mode A:** jobs run in-process; verify logs during development.

---

## Database maintenance

### Backups

Before any production migration:

```bash
./scripts/backup-database.sh
# or .\scripts\backup-database.ps1
```

Retain 14+ days; copy off-server.

### Migrations

```bash
npx prisma migrate deploy   # production
npx prisma migrate dev --name <feature>   # development only
npx prisma generate
```

Phase 9 migration: `20260720100000_phase9_enterprise_hardening` (password history, trust score, fingerprint, storage quotas).

Never use `db push` on shared/production databases.

### Vacuum and analyze

On managed Postgres, autovacuum is usually sufficient. For large `audit_logs`:

```sql
VACUUM (ANALYZE) audit_logs;
```

Monitor table bloat quarterly above 25k officers.

---

## Cache maintenance

- Routine: rely on TTL.
- After config/incident: `POST /api/v1/admin/cache/clear` (SUPER_ADMIN).
- Redis restart: cache repopulates on demand — no manual warm-up required.

---

## Storage maintenance

Local Mode A:

```powershell
.\scripts\backup-storage.ps1
```

Production: S3/R2 lifecycle policies; reconcile `storageUsedBytes` if drift suspected via admin storage endpoint.

---

## Zero-downtime deployment notes

### Application-only changes (no schema)

1. `git pull && npm ci && npm run build`
2. `pm2 reload ecosystem.config.cjs --env production` (graceful)
3. Confirm `/api/v1/health/ready`

Rolling reload works with multiple instances if LB drains connections.

### Schema migrations

1. **Backup** database.
2. Deploy migration-compatible **code** that tolerates old + new schema when possible (expand-contract pattern).
3. `npx prisma migrate deploy` during low-traffic window.
4. Reload PM2.

**Breaking migrations** (column rename/drop): maintenance window or blue-green with dual-write period.

Prisma migrations are forward-only — rollback app **and** restore DB if migration must be reverted.

### Redis / queue upgrades

- Pause traffic briefly or run rolling restart.
- BullMQ jobs survive Redis persistence (AOF/RDB).
- In-memory Mode A: restart clears queues — acceptable for dev only.

### WebSocket clients

`enableShutdownHooks()` allows in-flight requests to finish. Mobile apps should reconnect with backoff.

---

## Data retention

See [data-retention-notes.md](./data-retention-notes.md). Audit and session cleanup jobs align with organisational policy — stubs until retention windows are configured.

---

## Checklist (monthly)

- [ ] Verify backup restore drill on staging
- [ ] Review failed queue jobs
- [ ] Check disk / object storage growth
- [ ] SSL cert expiry (Certbot)
- [ ] Dependency security updates (`npm audit`)
- [ ] Postgres connection and slow-query review
