# GuardTrak API — Deployment

Two supported modes. **Docker is optional** and must never replace the local PostgreSQL 18 development workflow.

| Mode | Database | Storage | Redis | Process |
|------|----------|---------|-------|---------|
| **A — Development** | Local PostgreSQL **18** | Local filesystem | Optional (`REDIS_ENABLED=false`) | `npm run start:dev` |
| **B — Production** | Managed or host PostgreSQL 16+ | S3 / R2 / MinIO | Recommended | **PM2** (primary) or Docker Compose (optional) |

---

## Mode A — Current development (default)

### Stack

- Windows/macOS/Linux workstation
- **PostgreSQL 18** installed locally (listening on `localhost:5432`)
- Node.js 22+
- Local object storage under `STORAGE_LOCAL_ROOT` (default `./storage`)
- Redis **not required** (in-memory fallback)

### Setup

```bash
cd guardtrak-api
cp .env.example .env
# Edit DATABASE_URL to your local PostgreSQL 18 database
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed   # optional sample org
npm run start:dev
```

Typical Mode A `.env` values:

```env
NODE_ENV=development
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/guardtrak?schema=public
STORAGE_PROVIDER=local
STORAGE_LOCAL_ROOT=./storage
REDIS_ENABLED=false
EMAIL_ENABLED=false
FCM_ENABLED=false
AUTH_ALLOW_DEV_OTP_OUTPUT=true
```

Verify:

```bash
curl -fsS http://127.0.0.1:3000/api/v1/health/live
curl -fsS http://127.0.0.1:3000/api/v1/health/ready
```

Swagger (dev): http://localhost:3000/docs

### Optional local sidecars (Docker)

Only if you want Redis / MinIO / Mailpit **without** replacing Postgres:

```bash
# From repository root — does NOT start Postgres (avoids port 5432 clash)
docker compose --profile optional-deps up -d

# Or from guardtrak-api/
docker compose --profile optional-deps up -d
```

Then set `REDIS_ENABLED=true` and `REDIS_URL=redis://localhost:6379` if Redis is running.

**Do not** start the Compose `postgres` service while local PostgreSQL 18 uses port 5432. Postgres in Compose is behind profile `docker-db` for optional/CI use only.

---

## Mode B — Production (Ubuntu / Hostinger / DigitalOcean / AWS EC2 / Azure VM)

Primary path: **Node on the host with PM2**, Nginx reverse proxy, Let's Encrypt SSL, host or managed PostgreSQL. Docker Compose is an optional alternative (see [docker.md](./docker.md)).

### Supported platforms

Same steps apply to:

- Ubuntu Server 22.04 / 24.04
- Hostinger VPS
- DigitalOcean Droplet
- AWS EC2
- Azure Linux VM

### 1. Server packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx certbot python3-certbot-nginx build-essential git
# Node 22 via NodeSource or nvm
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

Install PostgreSQL on the same host **or** use a managed database. Application requires PostgreSQL 16+ (18 recommended to match development).

### 2. Application deploy

```bash
sudo mkdir -p /opt/guardtrak
sudo chown "$USER":"$USER" /opt/guardtrak
cd /opt/guardtrak
git clone <repo-url> .
cd guardtrak-api

cp .env.example .env
nano .env   # see docs/environment.md — Mode B section

npm ci
npx prisma generate
npm run build
npx prisma migrate deploy
```

### 3. PM2

Config file: [`ecosystem.config.cjs`](../ecosystem.config.cjs)

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup   # follow printed systemd instructions
pm2 status
pm2 logs guardtrak-api
```

Reload after deploy:

```bash
git pull
npm ci
npx prisma generate
npm run build
npx prisma migrate deploy
pm2 reload ecosystem.config.cjs --env production
```

### 4. Nginx reverse proxy

Canonical config: [`deploy/nginx/guardtrak-api.conf`](../deploy/nginx/guardtrak-api.conf)

```bash
sudo cp deploy/nginx/guardtrak-api.conf /etc/nginx/sites-available/guardtrak-api
sudo sed -i 's/api.example.com/YOUR_API_HOSTNAME/g' /etc/nginx/sites-available/guardtrak-api
sudo ln -sf /etc/nginx/sites-available/guardtrak-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Set in `.env`: `TRUST_PROXY=true`, `CORS_ORIGINS` / `WS_CORS_ORIGINS` to real client origins.

### 5. SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d api.yourdomain.com
sudo systemctl reload nginx
```

Certbot renews via timer; test with `sudo certbot renew --dry-run`.

Details: [`deploy/nginx/ssl.md`](../deploy/nginx/ssl.md)

### 6. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
# Do NOT expose 5432 / 6379 publicly
```

### 7. Production checklist

Use the full lists in [deployment-checklist.md](./deployment-checklist.md).

Short version:

- [ ] `NODE_ENV=production`
- [ ] Strong JWT secrets (no `change-me`)
- [ ] `AUTH_ALLOW_DEV_OTP_OUTPUT=false`
- [ ] `STORAGE_PROVIDER=s3` or `r2` (not `local` for evidence)
- [ ] `REDIS_ENABLED=true` recommended
- [ ] `TRUST_PROXY=true`
- [ ] Migrations applied
- [ ] `/api/v1/health/ready` returns 200
- [ ] Backups scheduled ([postgresql-backup.md](./postgresql-backup.md))
- [ ] SSL certificate valid

### 8. Rollback

See [deployment-checklist.md](./deployment-checklist.md#rollback-checklist). Summary:

1. `pm2 stop guardtrak-api`
2. `git checkout <previous-tag>` && `npm ci` && `npm run build`
3. Restore database from last good backup if needed ([postgresql-restore.md](./postgresql-restore.md))
4. `pm2 reload ecosystem.config.cjs --env production`
5. Confirm health endpoints before restoring traffic

### Optional: Docker production

Only if you choose containerised Postgres/API instead of PM2:

```bash
docker compose -f docker-compose.production.yml up -d --build
```

This path is optional and independent of Mode A. See [docker.md](./docker.md).

---

## Phase 9 operations (brief)

After Mode B deploy, confirm enterprise hardening:

- [ ] Phase 9 migration applied (`phase9_enterprise_hardening`)
- [ ] `AUTH_ALLOW_DEV_OTP_OUTPUT=false`, `AUTH_NEW_DEVICE_AUTO_APPROVE=false`
- [ ] Backup scripts scheduled — [scripts/README.md](../scripts/README.md)
- [ ] SUPER_ADMIN admin routes restricted — [administrator-guide.md](./administrator-guide.md)
- [ ] Security settings reviewed — [security-guide.md](./security-guide.md)

Full day-2 ops: [operations-manual.md](./operations-manual.md), [maintenance-guide.md](./maintenance-guide.md).

---

## Related docs

- [deployment-checklist.md](./deployment-checklist.md) — deploy & rollback checklists
- [environment.md](./environment.md) — all variables (Mode A vs B)
- [production.env.example](./production.env.example) — Mode B template
- [postgresql-backup.md](./postgresql-backup.md)
- [postgresql-restore.md](./postgresql-restore.md)
- [docker.md](./docker.md) — optional containers
- [monitoring.md](./monitoring.md) — health and metrics
- [operations-manual.md](./operations-manual.md) — Phase 9 day-2 ops
