# Clone local database → Railway

Live Railway Postgres starts empty (or seed-only). Local data does **not** sync automatically.
Use a dump/restore to copy local → Railway.

## 1) Export local (already supported)

```powershell
cd guardtrak-api
.\scripts\backup-database.ps1
```

Creates `backups/guardtrak_YYYYMMDD_HHmmss.dump` (gitignored).

## 2) Get Railway public DB URL

Railway → **Postgres** service → **Variables** → copy `DATABASE_PUBLIC_URL`  
(or `DATABASE_URL` if it already uses `*.proxy.rlwy.net`).

It looks like:

```text
postgresql://postgres:PASSWORD@HOST.proxy.rlwy.net:PORT/railway
```

## 3) Restore onto Railway (overwrites live data)

```powershell
cd guardtrak-api
.\scripts\restore-database.ps1 `
  -DumpPath ".\backups\guardtrak_YYYYMMDD_HHmmss.dump" `
  -DatabaseUrl "postgresql://postgres:PASSWORD@HOST.proxy.rlwy.net:PORT/railway"
```

Then:

```powershell
$env:DATABASE_URL = "postgresql://postgres:PASSWORD@HOST.proxy.rlwy.net:PORT/railway?schema=public&sslmode=require"
npx prisma migrate deploy
```

Restart the API service on Railway.

## Notes

- Restore is **destructive** on the target DB (`--clean`).
- Uploaded files on disk/S3 are **not** in the SQL dump — only database rows.
- After restore, use the **same logins as local** (password hashes come with the dump).
- Prefer `DATABASE_PUBLIC_URL` from your machine; private `*.railway.internal` only works inside Railway.
