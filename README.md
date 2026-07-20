# GuardTrak API

NestJS backend for the GuardTrak security workforce management platform.

## Mode A — Local development (default)

Uses **PostgreSQL 18 installed locally**. Docker is **not** required.

```bash
cp .env.example .env
# Set DATABASE_URL to your local PostgreSQL 18 database
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed   # optional
npm run start:dev
```

- API: http://localhost:3000/api/v1  
- Health: http://localhost:3000/api/v1/health/live  
- Swagger (dev): http://localhost:3000/docs  

Typical Mode A settings: `STORAGE_PROVIDER=local`, `REDIS_ENABLED=false`.

## Mode B — Production

Primary: **PM2 + Nginx + SSL** on Ubuntu / Hostinger / DigitalOcean / AWS EC2 / Azure VM.

See:

- [docs/deployment.md](docs/deployment.md)
- [docs/deployment-checklist.md](docs/deployment-checklist.md)
- [docs/environment.md](docs/environment.md)
- [docs/postgresql-backup.md](docs/postgresql-backup.md)
- [docs/postgresql-restore.md](docs/postgresql-restore.md)
- [`ecosystem.config.cjs`](ecosystem.config.cjs)
- [`deploy/nginx/`](deploy/nginx/)

```bash
npm ci && npx prisma generate && npm run build
pm2 start ecosystem.config.cjs --env production
```

Docker Compose remains an **optional** alternative and will not replace local PostgreSQL 18 in Mode A ([docs/docker.md](docs/docker.md)).

## Scripts

```bash
npm run start:dev    # watch mode
npm run build
npm run start:prod   # node dist/src/main
npm run lint
npm test
npm run test:e2e
```

## Documentation

Architecture and domain docs live under [`docs/`](docs/). Roadmap: [`docs/backend-roadmap.md`](docs/backend-roadmap.md).
