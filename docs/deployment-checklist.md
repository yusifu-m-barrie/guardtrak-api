# Deployment & rollback checklists

Development (**Mode A**) stays on local PostgreSQL 18 + `npm run start:dev`. These lists apply to **Mode B** production (Ubuntu / Hostinger / DigitalOcean / AWS EC2 / Azure VM).

Full guide: [deployment.md](./deployment.md).

---

## Deployment checklist

### Server

- [ ] Ubuntu 22.04+ (or equivalent) with SSH access
- [ ] Node.js 22+ installed
- [ ] `pm2` installed globally (`npm i -g pm2`)
- [ ] Nginx installed
- [ ] Certbot installed (for Let's Encrypt)
- [ ] Firewall: SSH + HTTP/HTTPS only; **5432 / 6379 not public**
- [ ] Domain DNS `A`/`AAAA` points at the server

### Database

- [ ] PostgreSQL 16+ available (18 recommended; host or managed)
- [ ] Database and app user created
- [ ] `DATABASE_URL` tested with `psql` / `pg_isready`
- [ ] Fresh backup taken ([postgresql-backup.md](./postgresql-backup.md))

### Application

- [ ] Repo cloned under `/opt/guardtrak` (or chosen path)
- [ ] `.env` created from `.env.example` — Mode B values ([environment.md](./environment.md))
- [ ] `NODE_ENV=production`
- [ ] Strong `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (no `change-me`)
- [ ] `AUTH_ALLOW_DEV_OTP_OUTPUT=false`
- [ ] `AUTH_NEW_DEVICE_AUTO_APPROVE=false`
- [ ] `STORAGE_PROVIDER` is `s3` or `r2` (not `local` for evidence)
- [ ] `REDIS_ENABLED=true` (recommended) and Redis reachable
- [ ] `TRUST_PROXY=true`
- [ ] `CORS_ORIGINS` / `WS_CORS_ORIGINS` match production clients
- [ ] `npm ci` && `npx prisma generate` && `npm run build`
- [ ] `npx prisma migrate deploy`
- [ ] `pm2 start ecosystem.config.cjs --env production` (or `npm run pm2:start`)
- [ ] `pm2 save` && `pm2 startup` configured

### Edge

- [ ] Nginx site installed from `deploy/nginx/guardtrak-api.conf`
- [ ] `server_name` replaced with real hostname
- [ ] `sudo nginx -t` && reload
- [ ] SSL via `sudo certbot --nginx -d api.yourdomain.com` ([deploy/nginx/ssl.md](../deploy/nginx/ssl.md))

### Smoke tests

- [ ] `GET /api/v1/health/live` → 200
- [ ] `GET /api/v1/health/ready` → 200
- [ ] Login / one authenticated API call succeeds
- [ ] WebSocket `/realtime` connects behind Nginx (if used)
- [ ] Metrics endpoint OK if enabled

### Operations

- [ ] Backup cron scheduled
- [ ] Log rotation / `pm2 logs` reviewed
- [ ] Off-site copy of `.env` secrets (secrets manager or encrypted store)

---

## Rollback checklist

### Quick app rollback (no DB restore)

- [ ] `pm2 stop guardtrak-api`
- [ ] `git fetch` && `git checkout <previous-good-tag>`
- [ ] `npm ci` && `npx prisma generate` && `npm run build`
- [ ] **Do not** run new migrations if rolling back past a schema change
- [ ] `pm2 reload ecosystem.config.cjs --env production`
- [ ] Confirm `/api/v1/health/ready`
- [ ] Spot-check critical APIs (auth, attendance, or last failing path)

### Rollback with database restore

Use when a migration or data change is bad.

- [ ] `pm2 stop guardtrak-api`
- [ ] Restore last good dump ([postgresql-restore.md](./postgresql-restore.md))
- [ ] Checkout matching application tag (schema must match dump)
- [ ] `npm ci` && `npx prisma generate` && `npm run build`
- [ ] `npx prisma migrate deploy` only if the dump’s migration history expects it
- [ ] `pm2 reload ecosystem.config.cjs --env production`
- [ ] Confirm health + smoke tests
- [ ] Notify stakeholders; keep failed release artifacts for postmortem

### After rollback

- [ ] Document root cause
- [ ] Fix forward on a branch; re-deploy via normal checklist
- [ ] Take a new backup after stable restore

---

## Optional Docker production

Only if you intentionally use Compose instead of PM2:

- [ ] Review `docker-compose.production.yml` (does **not** affect Mode A local PG 18)
- [ ] Set production secrets in `.env`
- [ ] `docker compose -f docker-compose.production.yml up -d --build`
- [ ] Run migrations inside the stack
- [ ] Point Nginx at the published API port

**Never** start Compose Postgres (`--profile docker-db` / `--profile api`) on a machine where local PostgreSQL 18 already owns port `5432`.
