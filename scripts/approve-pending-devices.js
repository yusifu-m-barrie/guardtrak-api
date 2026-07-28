require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const pending = await c.query(`
    SELECT d.id, d.status, d.platform, d."installationId", d."deviceName", u."employeeId"
    FROM devices d
    JOIN users u ON u.id = d."userId"
    WHERE d.status = 'PENDING'
    ORDER BY d."createdAt" DESC
    LIMIT 20
  `);
  console.log('PENDING before:', JSON.stringify(pending.rows, null, 2));

  const updated = await c.query(`
    UPDATE devices
    SET status = 'ACTIVE',
        "trustedAt" = COALESCE("trustedAt", NOW()),
        "updatedAt" = NOW()
    WHERE status = 'PENDING'
    RETURNING id, platform, "installationId", status
  `);
  console.log('Approved count:', updated.rowCount);
  console.log('Approved:', JSON.stringify(updated.rows, null, 2));

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
