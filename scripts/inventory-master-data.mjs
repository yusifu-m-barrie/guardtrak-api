import 'dotenv/config';
import pg from 'pg';

const url = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
const pool = new pg.Pool({
  connectionString: url,
  ssl: /railway|amazonaws|neon|render/i.test(url ?? '')
    ? { rejectUnauthorized: false }
    : undefined,
});

const orgs = await pool.query(
  `SELECT code, name FROM organisations WHERE "deletedAt" IS NULL`,
);
console.log('ORGS', orgs.rows);

const users = await pool.query(
  `SELECT role, "employeeId" AS emp, "firstName", "lastName",
          ("createdAt" AT TIME ZONE 'UTC')::date::text AS created
   FROM users WHERE "deletedAt" IS NULL ORDER BY "createdAt"`,
);
console.log('USERS', users.rows);

const sites = await pool.query(
  `SELECT name, code, ("createdAt" AT TIME ZONE 'UTC')::date::text AS created
   FROM security_sites WHERE "deletedAt" IS NULL ORDER BY "createdAt"`,
);
console.log('SITES', sites.rows);

await pool.end();
