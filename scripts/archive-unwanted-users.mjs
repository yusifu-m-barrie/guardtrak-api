/**
 * Archive leftover demo / unwanted accounts after real-testing cleanup.
 *
 * Usage (Railway shell):
 *   CONFIRM=YES node scripts/archive-unwanted-users.mjs
 */
import pg from 'pg';

try {
  const dotenv = await import('dotenv');
  dotenv.config();
} catch {
  // Railway injects DATABASE_URL
}

const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL or DATABASE_PUBLIC_URL is required');
  process.exit(1);
}

const DRY_RUN = process.env.DRY_RUN !== '0' && process.env.CONFIRM !== 'YES';
const ORG_CODE = (process.env.ORG_CODE || 'FOLPS').trim();

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: /railway|amazonaws|neon|render/i.test(databaseUrl)
    ? { rejectUnauthorized: false }
    : undefined,
});

async function main() {
  const client = await pool.connect();
  try {
    const orgRes = await client.query(
      `SELECT id, code, name FROM organisations
       WHERE "deletedAt" IS NULL
         AND code IN ($1, 'GUARDTRAK', 'FOLPS')
       ORDER BY CASE code WHEN $1 THEN 0 WHEN 'FOLPS' THEN 1 ELSE 2 END
       LIMIT 1`,
      [ORG_CODE],
    );
    const org = orgRes.rows[0];
    if (!org) throw new Error('Organisation not found');

    const targets = await client.query(
      `SELECT u.id, u.role, u."employeeId", u."firstName", u."lastName", u.email
       FROM users u
       WHERE u."organisationId" = $1
         AND u."deletedAt" IS NULL
         AND (
           u."employeeId" ILIKE 'E2E-%'
           OR u.email ILIKE '%@example.com'
           OR u."firstName" ILIKE '%salone%'
           OR u."lastName" ILIKE '%salone%'
           OR u."firstName" ILIKE '%plate%'
           OR u."lastName" ILIKE '%plate%'
           OR concat(u."firstName", ' ', u."lastName") ILIKE '%saloneplate%'
           OR concat(u."firstName", u."lastName") ILIKE '%saloneplate%'
           OR u."employeeId" ILIKE '%salone%'
           OR u.email ILIKE '%salone%'
         )
         AND u."employeeId" <> 'ADM-001'
         AND u.role <> 'SUPER_ADMIN'
       ORDER BY u."createdAt"`,
      [org.id],
    );

    // Also catch supervisors by profile title / number
    const byProfile = await client.query(
      `SELECT u.id, u.role, u."employeeId", u."firstName", u."lastName", u.email,
              sp."supervisorNumber", sp.title
       FROM supervisor_profiles sp
       JOIN users u ON u.id = sp."userId"
       WHERE sp."organisationId" = $1
         AND sp."deletedAt" IS NULL
         AND u."deletedAt" IS NULL
         AND (
           sp.title ILIKE '%salone%'
           OR sp."supervisorNumber" ILIKE '%salone%'
           OR sp.title ILIKE '%plate%'
         )
         AND u."employeeId" <> 'ADM-001'`,
      [org.id],
    );

    const byId = new Map();
    for (const row of [...targets.rows, ...byProfile.rows]) {
      byId.set(row.id, row);
    }
    const rows = [...byId.values()];

    console.log(`Org: ${org.name} (${org.code})`);
    console.log(DRY_RUN ? 'Mode: DRY RUN' : 'Mode: APPLYING');
    console.log(`\n=== ARCHIVE targets (${rows.length}) ===`);
    for (const row of rows) {
      console.log(JSON.stringify(row));
    }

    if (!rows.length) {
      console.log('\nNothing matched. Listing active supervisors for reference:');
      const supers = await client.query(
        `SELECT u."employeeId", u."firstName", u."lastName", u.email, sp.title, sp."supervisorNumber"
         FROM supervisor_profiles sp
         JOIN users u ON u.id = sp."userId"
         WHERE sp."organisationId" = $1 AND sp."deletedAt" IS NULL AND u."deletedAt" IS NULL
         ORDER BY u."createdAt"`,
        [org.id],
      );
      for (const row of supers.rows) console.log(JSON.stringify(row));
      return;
    }

    if (DRY_RUN) {
      console.log('\nDry run only. Re-run with CONFIRM=YES DRY_RUN=0 to apply.');
      return;
    }

    const ids = rows.map((r) => r.id);
    await client.query('BEGIN');
    await client.query(
      `UPDATE users
       SET status = 'ARCHIVED', "deletedAt" = NOW(), "updatedAt" = NOW()
       WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    await client.query(
      `UPDATE officer_profiles
       SET "employmentStatus" = 'TERMINATED', "deletedAt" = NOW(), "updatedAt" = NOW()
       WHERE "userId" = ANY($1::uuid[]) AND "deletedAt" IS NULL`,
      [ids],
    );
    await client.query(
      `UPDATE supervisor_profiles
       SET "deletedAt" = NOW(), "updatedAt" = NOW()
       WHERE "userId" = ANY($1::uuid[]) AND "deletedAt" IS NULL`,
      [ids],
    );
    await client.query(
      `DELETE FROM supervisor_officers so
       USING supervisor_profiles sp
       WHERE so."supervisorId" = sp.id
         AND sp."userId" = ANY($1::uuid[])`,
      [ids],
    );
    await client.query('COMMIT');
    console.log(`\nArchived ${ids.length} users.`);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
