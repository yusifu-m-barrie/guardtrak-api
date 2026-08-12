# Database Seeding

## Command

```bash
npm run prisma:seed
```

Configured in `prisma.config.ts` as `tsx prisma/seed.ts`.

## Idempotency

Seed uses stable UUIDs and `upsert` / existence checks. Running twice must not duplicate core records.

## Development credentials (local only)

Password for all seeded users:

```text
FOLPS!Dev2026
```

| Email | Role |
|-------|------|
| `superadmin@guardtrak.local` | SUPER_ADMIN |
| `admin@guardtrak.local` | ADMINISTRATOR |
| `supervisor@guardtrak.local` | SUPERVISOR |
| `officer@guardtrak.local` | SECURITY_OFFICER |
| `officer2@guardtrak.local` | SECURITY_OFFICER |

Passwords are hashed with **Argon2**. Never use these accounts in production.

## Seeded domain data

- Organisation: GuardTrak Security Services (`Africa/Freetown`)
- Client: Freetown Commercial Plaza
- Sites: Plaza Main Gate, Plaza Parking Deck
- Current + upcoming shifts and assignments
- Clocked-in attendance + meal break
- Patrol route with 3 checkpoints + in-progress patrol assignment
- Sample incident + supervisor-only note
- Resolved SOS example
- Notification + preferences for all seeded users
