/**
 * Archive specific users by employeeId.
 * Usage:
 *   EMPLOYEE_IDS=3360 CONFIRM=YES node scripts/archive-by-employee-id.mjs
 */
import pg from 'pg';

try {
  const dotenv = await import('dotenv');
  dotenv.config();
} catch {
  // ignore
}

const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL or DATABASE_PUBLIC_URL is required');
  process.exit(1);
}

const ids = (process.env.EMPLOYEE_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (!ids.length) {
  console.error('Set EMPLOYEE_IDS=3360[,...]');
  process.exit(1);
}

const DRY_RUN = process.env.DRY_RUN !== '0' && process.env.CONFIRM !== 'YES';

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: /railway|amazonaws|neon|render/i.test(databaseUrl)
    ? { rejectUnauthorized: false }
    : undefined,
});

async function main() {
  const client = await pool.connect();
  try {
    const found = await client.query(
      `SELECT u.id, u.role, u."employeeId", u."firstName", u."lastName",
              u.email, u.status, u."deletedAt"
       FROM users u
       WHERE u."employeeId" = ANY($1::text[])
       ORDER BY u."employeeId"`,
      [ids],
    );

    console.log(DRY_RUN ? 'Mode: DRY RUN' : 'Mode: APPLYING');
    console.log(`\n=== MATCHES (${found.rows.length}) ===`);
    for (const row of found.rows) console.log(JSON.stringify(row));

    if (!found.rows.length) {
      console.log('No users found for those employee IDs.');
      return;
    }

    if (DRY_RUN) {
      console.log('\nRe-run with CONFIRM=YES DRY_RUN=0 to apply.');
      return;
    }

    const userIds = found.rows.map((r) => r.id);
    await client.query('BEGIN');
    await client.query(
      `UPDATE users
       SET status = 'ARCHIVED', "deletedAt" = COALESCE("deletedAt", NOW()), "updatedAt" = NOW()
       WHERE id = ANY($1::uuid[])`,
      [userIds],
    );
    await client.query(
      `UPDATE officer_profiles
       SET "employmentStatus" = 'TERMINATED',
           "deletedAt" = COALESCE("deletedAt", NOW()),
           "updatedAt" = NOW()
       WHERE "userId" = ANY($1::uuid[])`,
      [userIds],
    );
    await client.query(
      `UPDATE supervisor_profiles
       SET "deletedAt" = COALESCE("deletedAt", NOW()), "updatedAt" = NOW()
       WHERE "userId" = ANY($1::uuid[])`,
      [userIds],
    );
    await client.query(
      `DELETE FROM supervisor_officers so
       USING supervisor_profiles sp
       WHERE so."supervisorId" = sp.id AND sp."userId" = ANY($1::uuid[])`,
      [userIds],
    );
    await client.query(
      `UPDATE refresh_sessions
       SET "revokedAt" = COALESCE("revokedAt", NOW())
       WHERE "userId" = ANY($1::uuid[]) AND "revokedAt" IS NULL`,
      [userIds],
    );
    await client.query('COMMIT');
    console.log(`\nArchived ${userIds.length} user(s): ${ids.join(', ')}`);
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
