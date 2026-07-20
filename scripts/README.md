# Phase 9 — Operational scripts

Helper scripts for **local PostgreSQL 18** (Mode A) and production hosts. Requires `pg_dump` / `pg_restore` on PATH (PostgreSQL 18 client tools).

| Script | Purpose |
|--------|---------|
| `backup-database.ps1` / `backup-database.sh` | Custom-format (`-Fc`) Postgres dump |
| `restore-database.ps1` / `restore-database.sh` | Restore from `-Fc` dump |
| `backup-storage.ps1` | Zip `STORAGE_LOCAL_ROOT` (default `./storage`) |

## Database backup

Uses `DATABASE_URL` from environment or `.env`, or pass explicit connection args.

**PowerShell:**

```powershell
.\scripts\backup-database.ps1
.\scripts\backup-database.ps1 -OutputPath "C:\backups\guardtrak.dump"
```

**Bash:**

```bash
./scripts/backup-database.sh
./scripts/backup-database.sh ./backups/guardtrak.dump
```

Output default: `backups/guardtrak_YYYYMMDD_HHmmss.dump` under project root.

See [docs/postgresql-backup.md](../docs/postgresql-backup.md).

## Database restore

**Destructive** on target DB when using `--clean`. Test on a scratch database first.

```powershell
.\scripts\restore-database.ps1 -DumpPath ".\backups\guardtrak_20260720.dump"
```

```bash
./scripts/restore-database.sh ./backups/guardtrak_20260720.dump
```

After restore: `npx prisma generate && npx prisma migrate deploy` then restart the API.

See [docs/postgresql-restore.md](../docs/postgresql-restore.md).

## Storage backup (local)

```powershell
.\scripts\backup-storage.ps1
.\scripts\backup-storage.ps1 -StorageRoot ".\storage" -OutputPath ".\backups\storage.zip"
```

Production evidence on S3/R2 is **not** included — use provider lifecycle/replication.

## Other scripts

| Script | Notes |
|--------|-------|
| `cleanup-e2e-admins.ts` | Test data cleanup |
| `check-auth-migration.ts` | Migration verification |
