# CI/CD

Continuous integration is defined in `.github/workflows/ci.yml`.

## Triggers

- Push to `main`, `master`, or `develop`
- Pull requests

## Pipeline (`build-test`)

1. **Checkout** — repository root (workflow lives in `guardtrak-api/`)
2. **Node 22** — `npm ci` with lockfile cache
3. **Prisma** — `npx prisma generate`
4. **Lint** — `npm run lint`
5. **Unit tests** — `npm test`
6. **Postgres 17** — GitHub Actions service container
7. **Migrate** — `npx prisma migrate deploy`
8. **Seed** — `npx prisma db seed` (continues on error if seed unavailable)
9. **E2E** — `npm run test:e2e` (includes `phase8-infra.e2e-spec.ts`)
10. **Build** — `npm run build`

## CI environment

Key overrides (see workflow file for full list):

- `NODE_ENV=test`
- `DATABASE_URL=postgresql://guardtrak:...@localhost:5432/guardtrak_db`
- `REDIS_ENABLED=false` — in-memory Redis fallback
- `EMAIL_ENABLED=false`, `FCM_ENABLED=false`, `APNS_ENABLED=false`
- Non-placeholder JWT secrets for test

## Placeholder jobs

- **`docker`** — disabled (`if: false`); wire container registry publish when ready
- **`deploy`** — disabled; connect to Hostinger VPS or orchestrator after approval

## Local parity

Reproduce CI locally:

```bash
export NODE_ENV=test REDIS_ENABLED=false
npx prisma migrate deploy
npm run test:e2e
npm run build
```

See [deployment.md](./deployment.md) for production rollout.
