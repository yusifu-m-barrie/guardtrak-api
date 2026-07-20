import 'dotenv/config';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';

/* eslint-disable @typescript-eslint/no-unsafe-member-access -- pg QueryResult rows are untyped */

const url = process.env.DATABASE_URL ?? '';
const canRun = url.startsWith('postgresql://') || url.startsWith('postgres://');

const describeDb = canRun ? describe : describe.skip;

function rowId(rows: Array<Record<string, unknown>>, index = 0): string {
  const value = rows[index]?.id;
  if (typeof value !== 'string') {
    throw new Error('Expected row id string');
  }
  return value;
}

describeDb('PostgreSQL schema constraints (local DB via pg)', () => {
  let pool: Pool;
  const orgId = randomUUID();
  const suffix = randomUUID().slice(0, 8);

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    await pool.query(
      `INSERT INTO organisations (id, code, name, timezone, status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'Africa/Freetown', 'ACTIVE', NOW(), NOW())`,
      [
        orgId,
        `ORG${suffix}`.toUpperCase().slice(0, 12),
        `Constraint Test Org ${suffix}`,
      ],
    );
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM idempotency_records WHERE "organisationId" = $1`,
      [orgId],
    );
    await pool.query(`DELETE FROM patrol_visits WHERE "organisationId" = $1`, [
      orgId,
    ]);
    await pool.query(
      `DELETE FROM patrol_assignments WHERE "organisationId" = $1`,
      [orgId],
    );
    await pool.query(
      `DELETE FROM patrol_checkpoints WHERE "organisationId" = $1`,
      [orgId],
    );
    await pool.query(`DELETE FROM patrol_routes WHERE "organisationId" = $1`, [
      orgId,
    ]);
    await pool.query(`DELETE FROM shift_breaks WHERE "organisationId" = $1`, [
      orgId,
    ]);
    await pool.query(
      `DELETE FROM attendance_events WHERE "organisationId" = $1`,
      [orgId],
    );
    await pool.query(`DELETE FROM attendances WHERE "organisationId" = $1`, [
      orgId,
    ]);
    await pool.query(
      `DELETE FROM assignment_events WHERE "assignmentId" IN (SELECT id FROM assignments WHERE "organisationId" = $1)`,
      [orgId],
    );
    await pool.query(`DELETE FROM assignments WHERE "organisationId" = $1`, [
      orgId,
    ]);
    await pool.query(`DELETE FROM shifts WHERE "organisationId" = $1`, [orgId]);
    await pool.query(`DELETE FROM emergencies WHERE "organisationId" = $1`, [
      orgId,
    ]);
    await pool.query(`DELETE FROM incident_notes WHERE "organisationId" = $1`, [
      orgId,
    ]);
    await pool.query(
      `DELETE FROM incident_status_events WHERE "organisationId" = $1`,
      [orgId],
    );
    await pool.query(`DELETE FROM incidents WHERE "organisationId" = $1`, [
      orgId,
    ]);
    await pool.query(`DELETE FROM evidences WHERE "organisationId" = $1`, [
      orgId,
    ]);
    await pool.query(`DELETE FROM devices WHERE "organisationId" = $1`, [
      orgId,
    ]);
    await pool.query(
      `DELETE FROM officer_profiles WHERE "organisationId" = $1`,
      [orgId],
    );
    await pool.query(
      `DELETE FROM supervisor_profiles WHERE "organisationId" = $1`,
      [orgId],
    );
    await pool.query(`DELETE FROM security_sites WHERE "organisationId" = $1`, [
      orgId,
    ]);
    await pool.query(`DELETE FROM clients WHERE "organisationId" = $1`, [
      orgId,
    ]);
    await pool.query(`DELETE FROM users WHERE "organisationId" = $1`, [orgId]);
    await pool.query(`DELETE FROM organisations WHERE id = $1`, [orgId]);
    await pool.end();
  });

  async function expectUniqueViolation(
    fn: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await fn();
      throw new Error('Expected unique violation');
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : '';
      expect(code).toBe('23505');
    }
  }

  it('enforces organisation-scoped employeeId uniqueness and argon2 hashes', async () => {
    const hash = await argon2.hash('ConstraintTest!1');
    const userId = randomUUID();
    await pool.query(
      `INSERT INTO users (id, "organisationId", "employeeId", email, "passwordHash", "firstName", "lastName", role, status, "mustChangePassword", "failedLoginAttempts", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'A','One','ADMINISTRATOR','ACTIVE', false, 0, NOW(), NOW())`,
      [userId, orgId, `EMP-${suffix}`, `emp1-${suffix}@test.local`, hash],
    );

    expect(hash.startsWith('$argon2')).toBe(true);
    expect(hash.includes('ConstraintTest!1')).toBe(false);

    await expectUniqueViolation(() =>
      pool.query(
        `INSERT INTO users (id, "organisationId", "employeeId", email, "passwordHash", "firstName", "lastName", role, status, "mustChangePassword", "failedLoginAttempts", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,'B','Two','ADMINISTRATOR','ACTIVE', false, 0, NOW(), NOW())`,
        [
          randomUUID(),
          orgId,
          `EMP-${suffix}`,
          `emp2-${suffix}@test.local`,
          hash,
        ],
      ),
    );
  });

  it('enforces officer number uniqueness within organisation', async () => {
    const hash = await argon2.hash('ConstraintTest!1');
    const u1 = randomUUID();
    const u2 = randomUUID();
    await pool.query(
      `INSERT INTO users (id, "organisationId", "employeeId", email, "passwordHash", "firstName", "lastName", role, status, "mustChangePassword", "failedLoginAttempts", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'Off','A','SECURITY_OFFICER','ACTIVE', false, 0, NOW(), NOW())`,
      [u1, orgId, `OFFA-${suffix}`, `offa-${suffix}@test.local`, hash],
    );
    await pool.query(
      `INSERT INTO users (id, "organisationId", "employeeId", email, "passwordHash", "firstName", "lastName", role, status, "mustChangePassword", "failedLoginAttempts", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'Off','B','SECURITY_OFFICER','ACTIVE', false, 0, NOW(), NOW())`,
      [u2, orgId, `OFFB-${suffix}`, `offb-${suffix}@test.local`, hash],
    );
    await pool.query(
      `INSERT INTO officer_profiles (id, "organisationId", "userId", "officerNumber", "employmentStatus", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,'ACTIVE', NOW(), NOW())`,
      [randomUUID(), orgId, u1, `ON-${suffix}`],
    );

    await expectUniqueViolation(() =>
      pool.query(
        `INSERT INTO officer_profiles (id, "organisationId", "userId", "officerNumber", "employmentStatus", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,'ACTIVE', NOW(), NOW())`,
        [randomUUID(), orgId, u2, `ON-${suffix}`],
      ),
    );
  });

  it('enforces site code uniqueness within organisation', async () => {
    const clientId = randomUUID();
    await pool.query(
      `INSERT INTO clients (id, "organisationId", name, "primaryContactName", status, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,'Contact','ACTIVE', NOW(), NOW())`,
      [clientId, orgId, `Client ${suffix}`],
    );
    await pool.query(
      `INSERT INTO security_sites (id, "organisationId", "clientId", name, code, address, latitude, longitude, "clockInRadiusMeters", "clockOutRadiusMeters", "checkpointDefaultRadiusMeters", "minimumGpsAccuracyMeters", "clockInOutsideGeofencePolicy", "clockOutOutsideGeofencePolicy", "requiresClockInSelfie", "requiresClockOutSelfie", "requiresPatrol", "requiresFinalShiftNote", status, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,'Site A',$4,'Addr', 8.46, -13.23, 50, 50, 50, 50, 'REQUIRE_SUPERVISOR_APPROVAL', 'ALLOW_WITH_REASON', false, false, false, false, 'ACTIVE', NOW(), NOW())`,
      [randomUUID(), orgId, clientId, `CODE-${suffix}`],
    );

    await expectUniqueViolation(() =>
      pool.query(
        `INSERT INTO security_sites (id, "organisationId", "clientId", name, code, address, latitude, longitude, "clockInRadiusMeters", "clockOutRadiusMeters", "checkpointDefaultRadiusMeters", "minimumGpsAccuracyMeters", "clockInOutsideGeofencePolicy", "clockOutOutsideGeofencePolicy", "requiresClockInSelfie", "requiresClockOutSelfie", "requiresPatrol", "requiresFinalShiftNote", status, "createdAt", "updatedAt")
         VALUES ($1,$2,$3,'Site B',$4,'Addr 2', 8.47, -13.24, 50, 50, 50, 50, 'REQUIRE_SUPERVISOR_APPROVAL', 'ALLOW_WITH_REASON', false, false, false, false, 'ACTIVE', NOW(), NOW())`,
        [randomUUID(), orgId, clientId, `CODE-${suffix}`],
      ),
    );
  });

  it('enforces one attendance per assignment and storageKey uniqueness', async () => {
    const hash = await argon2.hash('ConstraintTest!1');
    const adminId = randomUUID();
    const officerUserId = randomUUID();
    const officerId = randomUUID();
    const site = await pool.query(
      `SELECT id FROM security_sites WHERE "organisationId" = $1 LIMIT 1`,
      [orgId],
    );
    const siteId = rowId(site.rows as Array<Record<string, unknown>>);

    await pool.query(
      `INSERT INTO users (id, "organisationId", "employeeId", email, "passwordHash", "firstName", "lastName", role, status, "mustChangePassword", "failedLoginAttempts", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'Ad','Min','ADMINISTRATOR','ACTIVE', false, 0, NOW(), NOW())`,
      [adminId, orgId, `ADM-${suffix}`, `adm-${suffix}@test.local`, hash],
    );
    await pool.query(
      `INSERT INTO users (id, "organisationId", "employeeId", email, "passwordHash", "firstName", "lastName", role, status, "mustChangePassword", "failedLoginAttempts", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'Off','C','SECURITY_OFFICER','ACTIVE', false, 0, NOW(), NOW())`,
      [
        officerUserId,
        orgId,
        `OFFC-${suffix}`,
        `offc-${suffix}@test.local`,
        hash,
      ],
    );
    await pool.query(
      `INSERT INTO officer_profiles (id, "organisationId", "userId", "officerNumber", "employmentStatus", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,'ACTIVE', NOW(), NOW())`,
      [officerId, orgId, officerUserId, `ONC-${suffix}`],
    );

    const shiftId = randomUUID();
    const assignmentId = randomUUID();
    await pool.query(
      `INSERT INTO shifts (id, "organisationId", "siteId", title, "scheduledStartAt", "scheduledEndAt", "unpaidBreakMinutes", "gracePeriodMinutes", status, "createdByUserId", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,'Constraint Shift', NOW(), NOW() + interval '1 hour', 0, 15, 'SCHEDULED', $4, NOW(), NOW())`,
      [shiftId, orgId, siteId, adminId],
    );
    await pool.query(
      `INSERT INTO assignments (id, "organisationId", "shiftId", "officerId", status, "assignedAt", "createdByUserId", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,'ASSIGNED', NOW(), $5, NOW(), NOW())`,
      [assignmentId, orgId, shiftId, officerId, adminId],
    );
    await pool.query(
      `INSERT INTO attendances (id, "organisationId", "assignmentId", "officerId", "shiftId", "siteId", status, "clockInOutsideGeofence", "clockOutOutsideGeofence", "totalBreakMinutes", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,'PENDING', false, false, 0, NOW(), NOW())`,
      [randomUUID(), orgId, assignmentId, officerId, shiftId, siteId],
    );

    await expectUniqueViolation(() =>
      pool.query(
        `INSERT INTO attendances (id, "organisationId", "assignmentId", "officerId", "shiftId", "siteId", status, "clockInOutsideGeofence", "clockOutOutsideGeofence", "totalBreakMinutes", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,'PENDING', false, false, 0, NOW(), NOW())`,
        [randomUUID(), orgId, assignmentId, officerId, shiftId, siteId],
      ),
    );

    const key = `org/${orgId}/evidence/${suffix}.jpg`;
    await pool.query(
      `INSERT INTO evidences (id, "organisationId", "uploadedByUserId", type, status, "scanStatus", "originalFileName", "storageProvider", "storageBucket", "storageKey", "mimeType", "sizeBytes", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,'IMAGE','PENDING_UPLOAD','NOT_SCANNED','a.jpg','local','dev',$4,'image/jpeg',100, NOW(), NOW())`,
      [randomUUID(), orgId, adminId, key],
    );

    await expectUniqueViolation(() =>
      pool.query(
        `INSERT INTO evidences (id, "organisationId", "uploadedByUserId", type, status, "scanStatus", "originalFileName", "storageProvider", "storageBucket", "storageKey", "mimeType", "sizeBytes", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,'IMAGE','PENDING_UPLOAD','NOT_SCANNED','b.jpg','local','dev',$4,'image/jpeg',100, NOW(), NOW())`,
        [randomUUID(), orgId, adminId, key],
      ),
    );
  });

  it('enforces patrol checkpoint sequence and visit duplicate prevention', async () => {
    const admin = await pool.query(
      `SELECT id FROM users WHERE "organisationId" = $1 AND role = 'ADMINISTRATOR' LIMIT 1`,
      [orgId],
    );
    const officer = await pool.query(
      `SELECT id FROM officer_profiles WHERE "organisationId" = $1 LIMIT 1`,
      [orgId],
    );
    const site = await pool.query(
      `SELECT id FROM security_sites WHERE "organisationId" = $1 LIMIT 1`,
      [orgId],
    );
    const shift = await pool.query(
      `SELECT id FROM shifts WHERE "organisationId" = $1 LIMIT 1`,
      [orgId],
    );
    const assignment = await pool.query(
      `SELECT id FROM assignments WHERE "organisationId" = $1 LIMIT 1`,
      [orgId],
    );

    const routeId = randomUUID();
    await pool.query(
      `INSERT INTO patrol_routes (id, "organisationId", "siteId", name, status, "createdByUserId", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,'DRAFT',$5, NOW(), NOW())`,
      [routeId, orgId, site.rows[0].id, `Route ${suffix}`, admin.rows[0].id],
    );

    const cpId = randomUUID();
    await pool.query(
      `INSERT INTO patrol_checkpoints (id, "organisationId", "patrolRouteId", name, sequence, latitude, longitude, "allowedRadiusMeters", "requiresPhoto", "requiresNote", active, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,'CP1',1, 8.46, -13.23, 30, false, false, true, NOW(), NOW())`,
      [cpId, orgId, routeId],
    );

    await expectUniqueViolation(() =>
      pool.query(
        `INSERT INTO patrol_checkpoints (id, "organisationId", "patrolRouteId", name, sequence, latitude, longitude, "allowedRadiusMeters", "requiresPhoto", "requiresNote", active, "createdAt", "updatedAt")
         VALUES ($1,$2,$3,'CP1-dup',1, 8.46, -13.23, 30, false, false, true, NOW(), NOW())`,
        [randomUUID(), orgId, routeId],
      ),
    );

    const patrolAssignmentId = randomUUID();
    await pool.query(
      `INSERT INTO patrol_assignments (id, "organisationId", "patrolRouteId", "assignmentId", "officerId", "shiftId", "siteId", status, "completedCheckpointCount", "totalCheckpointCount", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,'NOT_STARTED',0,1, NOW(), NOW())`,
      [
        patrolAssignmentId,
        orgId,
        routeId,
        assignment.rows[0].id,
        officer.rows[0].id,
        shift.rows[0].id,
        site.rows[0].id,
      ],
    );

    const snapId = randomUUID();
    await pool.query(
      `INSERT INTO patrol_assignment_checkpoints (id, "organisationId", "patrolAssignmentId", "sourceCheckpointId", name, sequence, latitude, longitude, "allowedRadiusMeters", "verificationMethod", "requiresPhoto", "requiresNote", "createdAt")
       VALUES ($1,$2,$3,$4,'CP1',1, 8.46, -13.23, 30, 'GPS', false, false, NOW())`,
      [snapId, orgId, patrolAssignmentId, cpId],
    );

    await pool.query(
      `INSERT INTO patrol_visits (id, "organisationId", "patrolAssignmentId", "patrolCheckpointId", "assignmentCheckpointId", "officerId", "shiftId", "siteId", status, "verificationMethod", "visitedAtDevice", latitude, longitude, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'COMPLETED','GPS', NOW(), 8.46, -13.23, NOW(), NOW())`,
      [
        randomUUID(),
        orgId,
        patrolAssignmentId,
        cpId,
        snapId,
        officer.rows[0].id,
        shift.rows[0].id,
        site.rows[0].id,
      ],
    );

    await expectUniqueViolation(() =>
      pool.query(
        `INSERT INTO patrol_visits (id, "organisationId", "patrolAssignmentId", "patrolCheckpointId", "assignmentCheckpointId", "officerId", "shiftId", "siteId", status, "verificationMethod", "visitedAtDevice", latitude, longitude, "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'COMPLETED','GPS', NOW(), 8.46, -13.23, NOW(), NOW())`,
        [
          randomUUID(),
          orgId,
          patrolAssignmentId,
          cpId,
          snapId,
          officer.rows[0].id,
          shift.rows[0].id,
          site.rows[0].id,
        ],
      ),
    );
  });

  it('enforces incident/emergency number and idempotency key uniqueness', async () => {
    const officer = await pool.query(
      `SELECT op.id AS "officerId", op."userId" FROM officer_profiles op WHERE op."organisationId" = $1 LIMIT 1`,
      [orgId],
    );
    const client = await pool.query(
      `SELECT id FROM clients WHERE "organisationId" = $1 LIMIT 1`,
      [orgId],
    );
    const site = await pool.query(
      `SELECT id FROM security_sites WHERE "organisationId" = $1 LIMIT 1`,
      [orgId],
    );

    await pool.query(
      `INSERT INTO incidents (id, "organisationId", "incidentNumber", "clientId", "siteId", "reportedByOfficerId", "reportedByUserId", category, severity, status, title, description, "occurredAtDevice", "reportedAtServer", "emergencyServicesContacted", "requiresImmediateNotification", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,'OTHER','LOW','DRAFT','Test','Test incident', NOW(), NOW(), false, false, NOW(), NOW())`,
      [
        randomUUID(),
        orgId,
        `INC-${suffix}`,
        client.rows[0].id,
        site.rows[0].id,
        officer.rows[0].officerId,
        officer.rows[0].userId,
      ],
    );

    await expectUniqueViolation(() =>
      pool.query(
        `INSERT INTO incidents (id, "organisationId", "incidentNumber", "clientId", "siteId", "reportedByOfficerId", "reportedByUserId", category, severity, status, title, description, "occurredAtDevice", "reportedAtServer", "emergencyServicesContacted", "requiresImmediateNotification", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,'OTHER','LOW','DRAFT','Test 2','Dup', NOW(), NOW(), false, false, NOW(), NOW())`,
        [
          randomUUID(),
          orgId,
          `INC-${suffix}`,
          client.rows[0].id,
          site.rows[0].id,
          officer.rows[0].officerId,
          officer.rows[0].userId,
        ],
      ),
    );

    await pool.query(
      `INSERT INTO emergencies (id, "organisationId", "emergencyNumber", "officerId", "userId", status, latitude, longitude, "deviceCreatedAt", "serverCreatedAt", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'CREATED', 8.46, -13.23, NOW(), NOW(), NOW(), NOW())`,
      [
        randomUUID(),
        orgId,
        `SOS-${suffix}`,
        officer.rows[0].officerId,
        officer.rows[0].userId,
      ],
    );

    await expectUniqueViolation(() =>
      pool.query(
        `INSERT INTO emergencies (id, "organisationId", "emergencyNumber", "officerId", "userId", status, latitude, longitude, "deviceCreatedAt", "serverCreatedAt", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,'CREATED', 8.46, -13.23, NOW(), NOW(), NOW(), NOW())`,
        [
          randomUUID(),
          orgId,
          `SOS-${suffix}`,
          officer.rows[0].officerId,
          officer.rows[0].userId,
        ],
      ),
    );

    await pool.query(
      `INSERT INTO idempotency_records (id, "organisationId", "userId", key, operation, "requestHash", status, "expiresAt", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,'clock-in','abc','RECEIVED', NOW() + interval '1 day', NOW(), NOW())`,
      [randomUUID(), orgId, officer.rows[0].userId, `key-${suffix}`],
    );

    await expectUniqueViolation(() =>
      pool.query(
        `INSERT INTO idempotency_records (id, "organisationId", "userId", key, operation, "requestHash", status, "expiresAt", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,'clock-in','def','RECEIVED', NOW() + interval '1 day', NOW(), NOW())`,
        [randomUUID(), orgId, officer.rows[0].userId, `key-${suffix}`],
      ),
    );
  });

  it('restricts deleting organisation with dependent users', async () => {
    try {
      await pool.query(`DELETE FROM organisations WHERE id = $1`, [orgId]);
      throw new Error('Expected restrict violation');
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : '';
      expect(['23503', '23001']).toContain(code);
    }
  });
});
