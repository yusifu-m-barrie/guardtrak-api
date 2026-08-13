/**
 * List active users / supervisors / sites for FOLPS cleanup checks.
 * Usage: node scripts/list-active-master-data.mjs
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

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: /railway|amazonaws|neon|render/i.test(databaseUrl)
    ? { rejectUnauthorized: false }
    : undefined,
});

const org = (
  await pool.query(
    `SELECT id, code, name FROM organisations
     WHERE "deletedAt" IS NULL AND code IN ('FOLPS', 'GUARDTRAK')
     ORDER BY CASE code WHEN 'FOLPS' THEN 0 ELSE 1 END LIMIT 1`,
  )
).rows[0];

if (!org) {
  console.error('No org found');
  process.exit(1);
}

console.log(`Org: ${org.name} (${org.code})\n`);

const users = await pool.query(
  `SELECT u.role, u."employeeId", u."firstName", u."lastName", u.email, u.status
   FROM users u
   WHERE u."organisationId" = $1 AND u."deletedAt" IS NULL
   ORDER BY u.role, u."createdAt"`,
  [org.id],
);
console.log('=== ACTIVE USERS ===');
for (const row of users.rows) console.log(JSON.stringify(row));

const supers = await pool.query(
  `SELECT u."employeeId", u."firstName", u."lastName", u.email,
          sp."supervisorNumber", sp.title, sp.id AS "supervisorProfileId"
   FROM supervisor_profiles sp
   JOIN users u ON u.id = sp."userId"
   WHERE sp."organisationId" = $1 AND sp."deletedAt" IS NULL AND u."deletedAt" IS NULL
   ORDER BY u."createdAt"`,
  [org.id],
);
console.log('\n=== ACTIVE SUPERVISORS ===');
for (const row of supers.rows) console.log(JSON.stringify(row));

const sites = await pool.query(
  `SELECT name, code, status FROM security_sites
   WHERE "organisationId" = $1 AND "deletedAt" IS NULL
   ORDER BY "createdAt"`,
  [org.id],
);
console.log('\n=== ACTIVE SITES ===');
for (const row of sites.rows) console.log(JSON.stringify(row));

await pool.end();
