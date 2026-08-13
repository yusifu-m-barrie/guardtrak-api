/**
 * Wipe demo / old ops data so FOLPS can be tested with real records.
 *
 * KEEP (by default):
 * - All ADMINISTRATOR / SUPER_ADMIN users
 * - Sites, clients, officers, supervisors, and other users created on/after KEEP_FROM
 * - Organisation row(s)
 *
 * DELETE (always, org-scoped):
 * - shifts, assignments, attendance, breaks
 * - incidents (+ notes/events/evidence linked)
 * - patrol routes/checkpoints/assignments/visits
 *
 * ARCHIVE (soft):
 * - sites / clients / officers / supervisors / users created BEFORE KEEP_FROM
 *   (except admins)
 *
 * Usage:
 *   DRY_RUN=1 node scripts/cleanup-real-testing.mjs
 *   CONFIRM=YES KEEP_FROM=2026-08-12 node scripts/cleanup-real-testing.mjs
 *
 * Requires DATABASE_URL or DATABASE_PUBLIC_URL (Railway public Postgres URL).
 */
import pg from 'pg';

try {
  const dotenv = await import('dotenv');
  dotenv.config();
} catch {
  // Optional locally; Railway already injects DATABASE_URL.
}

const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL or DATABASE_PUBLIC_URL is required');
  process.exit(1);
}

const KEEP_FROM = (process.env.KEEP_FROM || '2026-08-12').trim();
const DRY_RUN = process.env.DRY_RUN !== '0' && process.env.CONFIRM !== 'YES';
const ORG_CODE = (process.env.ORG_CODE || 'FOLPS').trim();

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: /railway|amazonaws|neon|render/i.test(databaseUrl)
    ? { rejectUnauthorized: false }
    : undefined,
});

function log(section, rows) {
  console.log(`\n=== ${section} (${rows.length}) ===`);
  for (const row of rows) {
    console.log(JSON.stringify(row));
  }
}

async function main() {
  const client = await pool.connect();
  try {
    const orgRes = await client.query(
      `SELECT id, code, name FROM organisations
       WHERE "deletedAt" IS NULL
         AND ($1 = '' OR code = $1 OR code = 'GUARDTRAK')
       ORDER BY
         CASE code WHEN $1 THEN 0 WHEN 'FOLPS' THEN 1 WHEN 'GUARDTRAK' THEN 2 ELSE 3 END,
         "createdAt" ASC
       LIMIT 1`,
      [ORG_CODE],
    );
    const org = orgRes.rows[0];
    if (!org) {
      throw new Error(`Organisation ${ORG_CODE} not found`);
    }
    console.log(`Org: ${org.name} (${org.code}) ${org.id}`);
    console.log(`Keep records created on/after: ${KEEP_FROM} (UTC date)`);
    console.log(DRY_RUN ? 'Mode: DRY RUN (no writes)' : 'Mode: APPLYING CHANGES');

    const users = await client.query(
      `SELECT id, role, "employeeId", "firstName", "lastName", email,
              ("createdAt" AT TIME ZONE 'UTC')::date::text AS created
       FROM users
       WHERE "organisationId" = $1 AND "deletedAt" IS NULL
       ORDER BY "createdAt"`,
      [org.id],
    );
    const keepUsers = users.rows.filter(
      (u) =>
        u.role === 'ADMINISTRATOR' ||
        u.role === 'SUPER_ADMIN' ||
        u.created >= KEEP_FROM,
    );
    const archiveUsers = users.rows.filter(
      (u) =>
        u.role !== 'ADMINISTRATOR' &&
        u.role !== 'SUPER_ADMIN' &&
        u.created < KEEP_FROM,
    );
    log('KEEP users', keepUsers);
    log('ARCHIVE users (old)', archiveUsers);

    const sites = await client.query(
      `SELECT id, name, code, "clientId",
              ("createdAt" AT TIME ZONE 'UTC')::date::text AS created
       FROM security_sites
       WHERE "organisationId" = $1 AND "deletedAt" IS NULL
       ORDER BY "createdAt"`,
      [org.id],
    );
    const keepSites = sites.rows.filter((s) => s.created >= KEEP_FROM);
    const archiveSites = sites.rows.filter((s) => s.created < KEEP_FROM);
    log('KEEP sites', keepSites);
    log('ARCHIVE sites (old)', archiveSites);

    const clients = await client.query(
      `SELECT id, name,
              ("createdAt" AT TIME ZONE 'UTC')::date::text AS created
       FROM clients
       WHERE "organisationId" = $1 AND "deletedAt" IS NULL
       ORDER BY "createdAt"`,
      [org.id],
    );
    const keepClientIds = new Set(keepSites.map((s) => s.clientId));
    const keepClients = clients.rows.filter(
      (c) => c.created >= KEEP_FROM || keepClientIds.has(c.id),
    );
    const archiveClients = clients.rows.filter(
      (c) => c.created < KEEP_FROM && !keepClientIds.has(c.id),
    );
    log('KEEP clients', keepClients);
    log('ARCHIVE clients (old)', archiveClients);

    const ops = await client.query(
      `SELECT
         (SELECT count(*)::int FROM shifts WHERE "organisationId" = $1) AS shifts,
         (SELECT count(*)::int FROM assignments WHERE "organisationId" = $1) AS assignments,
         (SELECT count(*)::int FROM attendances WHERE "organisationId" = $1) AS attendances,
         (SELECT count(*)::int FROM shift_breaks WHERE "organisationId" = $1) AS breaks,
         (SELECT count(*)::int FROM incidents WHERE "organisationId" = $1) AS incidents,
         (SELECT count(*)::int FROM patrol_routes WHERE "organisationId" = $1) AS patrol_routes,
         (SELECT count(*)::int FROM patrol_assignments WHERE "organisationId" = $1) AS patrol_assignments,
         (SELECT count(*)::int FROM patrol_visits WHERE "organisationId" = $1) AS patrol_visits,
         (SELECT count(*)::int FROM evidences WHERE "organisationId" = $1) AS evidences`,
      [org.id],
    );
    console.log('\n=== OPS counts (will wipe all) ===');
    console.log(ops.rows[0]);

    if (DRY_RUN) {
      console.log(
        '\nDry run only. Re-run with CONFIRM=YES DRY_RUN=0 to apply.',
      );
      return;
    }

    await client.query('BEGIN');

    // --- Wipe operational data (children first) ---
    const wipe = async (sql, label) => {
      const r = await client.query(sql, [org.id]);
      console.log(`Deleted ${r.rowCount} ${label}`);
    };

    await wipe(
      `DELETE FROM notification_deliveries WHERE "notificationId" IN (
         SELECT id FROM notifications WHERE "organisationId" = $1
       )`,
      'notification_deliveries',
    );
    await wipe(
      `DELETE FROM notifications WHERE "organisationId" = $1`,
      'notifications',
    );

    await wipe(
      `DELETE FROM incident_notes WHERE "organisationId" = $1`,
      'incident_notes',
    );
    await wipe(
      `DELETE FROM incident_status_events WHERE "organisationId" = $1`,
      'incident_status_events',
    );
    await wipe(
      `DELETE FROM evidences WHERE "organisationId" = $1`,
      'evidences',
    );
    await wipe(`DELETE FROM incidents WHERE "organisationId" = $1`, 'incidents');

    await wipe(
      `DELETE FROM patrol_visits WHERE "organisationId" = $1`,
      'patrol_visits',
    );
    await wipe(
      `DELETE FROM patrol_assignment_events pae
       USING patrol_assignments pa
       WHERE pae."patrolAssignmentId" = pa.id
         AND pa."organisationId" = $1`,
      'patrol_assignment_events',
    );
    await wipe(
      `DELETE FROM patrol_assignment_checkpoints WHERE "organisationId" = $1`,
      'patrol_assignment_checkpoints',
    );
    await wipe(
      `DELETE FROM patrol_assignments WHERE "organisationId" = $1`,
      'patrol_assignments',
    );
    await wipe(
      `DELETE FROM patrol_checkpoints WHERE "organisationId" = $1`,
      'patrol_checkpoints',
    );
    await wipe(
      `DELETE FROM patrol_routes WHERE "organisationId" = $1`,
      'patrol_routes',
    );

    await wipe(
      `DELETE FROM shift_breaks WHERE "organisationId" = $1`,
      'shift_breaks',
    );
    await wipe(
      `DELETE FROM attendance_events WHERE "organisationId" = $1`,
      'attendance_events',
    );
    await wipe(
      `DELETE FROM attendances WHERE "organisationId" = $1`,
      'attendances',
    );

    await wipe(
      `DELETE FROM assignment_events ae
       USING assignments a
       WHERE ae."assignmentId" = a.id
         AND a."organisationId" = $1`,
      'assignment_events',
    );
    await wipe(
      `DELETE FROM assignments WHERE "organisationId" = $1`,
      'assignments',
    );
    await wipe(`DELETE FROM shifts WHERE "organisationId" = $1`, 'shifts');

    await wipe(
      `DELETE FROM emergency_status_events WHERE "organisationId" = $1`,
      'emergency_status_events',
    );
    await wipe(
      `DELETE FROM emergencies WHERE "organisationId" = $1`,
      'emergencies',
    );

    // --- Soft-archive old master data ---
    const archiveUserIds = archiveUsers.map((u) => u.id);
    if (archiveUserIds.length) {
      await client.query(
        `UPDATE users
         SET status = 'ARCHIVED', "deletedAt" = NOW(), "updatedAt" = NOW()
         WHERE id = ANY($1::uuid[])`,
        [archiveUserIds],
      );
      await client.query(
        `UPDATE officer_profiles
         SET "employmentStatus" = 'TERMINATED', "deletedAt" = NOW(), "updatedAt" = NOW()
         WHERE "userId" = ANY($1::uuid[]) AND "deletedAt" IS NULL`,
        [archiveUserIds],
      );
      await client.query(
        `UPDATE supervisor_profiles
         SET "deletedAt" = NOW(), "updatedAt" = NOW()
         WHERE "userId" = ANY($1::uuid[]) AND "deletedAt" IS NULL`,
        [archiveUserIds],
      );
      console.log(`Archived ${archiveUserIds.length} users (+ profiles)`);
    }

    const archiveSiteIds = archiveSites.map((s) => s.id);
    if (archiveSiteIds.length) {
      await client.query(
        `UPDATE security_sites
         SET status = 'ARCHIVED', "deletedAt" = NOW(), "updatedAt" = NOW()
         WHERE id = ANY($1::uuid[])`,
        [archiveSiteIds],
      );
      console.log(`Archived ${archiveSiteIds.length} sites`);
    }

    const archiveClientIds = archiveClients.map((c) => c.id);
    if (archiveClientIds.length) {
      await client.query(
        `UPDATE clients
         SET status = 'ARCHIVED', "deletedAt" = NOW(), "updatedAt" = NOW()
         WHERE id = ANY($1::uuid[])`,
        [archiveClientIds],
      );
      console.log(`Archived ${archiveClientIds.length} clients`);
    }

    // Drop inactive supervisor↔officer links for archived people
    await client.query(
      `DELETE FROM supervisor_officers so
       USING supervisor_profiles sp, officer_profiles op
       WHERE so."supervisorId" = sp.id
         AND so."officerId" = op.id
         AND so."organisationId" = $1
         AND (sp."deletedAt" IS NOT NULL OR op."deletedAt" IS NOT NULL)`,
      [org.id],
    );

    await client.query('COMMIT');
    console.log('\nCleanup complete.');
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
