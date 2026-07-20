# Database Migrations

## Tooling

- Prisma 7 migrations under `prisma/migrations`
- Datasource URL from `prisma.config.ts` → `DATABASE_URL`
- Direct `postgresql://` / `postgres://` required for migrate and Nest runtime

## Initial migration

```text
20260718145609_init_guardtrak_schema
```

Created with:

```bash
npx prisma migrate dev --name init_guardtrak_schema
```

## Common commands

```bash
npx prisma migrate dev --name <name>
npx prisma migrate deploy
npx prisma generate
npm run prisma:seed
```

Do not use `prisma db push` as a substitute for committed migrations in shared environments.

## Resets

`prisma migrate reset` destroys local data. Only use deliberately on disposable development databases.
