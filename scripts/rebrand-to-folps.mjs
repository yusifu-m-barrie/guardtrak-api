/**
 * FOLPS rebrand for production containers (no tsx required).
 * Usage in Railway shell: npm run rebrand:folps
 */
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL (or DATABASE_PUBLIC_URL) is required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orgResult = await client.query(
      `SELECT id, code, name, email
       FROM organisations
       WHERE "deletedAt" IS NULL
         AND (
           code IN ('GUARDTRAK', 'FOLPS')
           OR name ILIKE '%GuardTrak%'
           OR name ILIKE '%Faith Of Life%'
         )
       ORDER BY
         CASE code WHEN 'GUARDTRAK' THEN 0 WHEN 'FOLPS' THEN 1 ELSE 2 END,
         "createdAt" ASC
       LIMIT 1`,
    );

    let org = orgResult.rows[0];
    if (!org) {
      const fallback = await client.query(
        `SELECT id, code, name, email
         FROM organisations
         WHERE "deletedAt" IS NULL
         ORDER BY "createdAt" ASC
         LIMIT 1`,
      );
      org = fallback.rows[0];
    }

    if (!org) {
      throw new Error('No organisation found to rebrand');
    }

    const nextEmail =
      org.email && /guardtrak/i.test(org.email) ? 'ops@folps.local' : org.email;

    const updatedOrg = await client.query(
      `UPDATE organisations
       SET code = 'FOLPS',
           name = 'Faith Of Life Protective Services',
           "legalName" = 'Faith Of Life Protective Services Ltd',
           email = COALESCE($2, email),
           "updatedAt" = NOW()
       WHERE id = $1
       RETURNING id, code, name`,
      [org.id, nextEmail],
    );

    const adminResult = await client.query(
      `SELECT id, email
       FROM users
       WHERE "organisationId" = $1
         AND "employeeId" = 'ADM-001'
         AND "deletedAt" IS NULL
       LIMIT 1`,
      [org.id],
    );

    let adminUpdated = false;
    if (adminResult.rows[0]) {
      const admin = adminResult.rows[0];
      const adminEmail = /guardtrak/i.test(admin.email)
        ? 'admin@folps.local'
        : admin.email;
      await client.query(
        `UPDATE users
         SET "firstName" = 'Daniel',
             "middleName" = 'Salifu',
             "lastName" = 'Samura',
             "displayName" = 'Daniel Salifu Samura',
             email = $2,
             "updatedAt" = NOW()
         WHERE id = $1`,
        [admin.id, adminEmail],
      );
      adminUpdated = true;
    }

    await client.query('COMMIT');

    console.log('Rebrand complete:', {
      organisationId: updatedOrg.rows[0].id,
      previousCode: org.code,
      code: updatedOrg.rows[0].code,
      name: updatedOrg.rows[0].name,
      adminUpdated,
      adminName: adminUpdated ? 'Daniel Salifu Samura' : null,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
