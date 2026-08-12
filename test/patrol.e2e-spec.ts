import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { asErrorBody, asSuccessBody } from './http-body';

const PASSWORD = 'FOLPS!Dev2026';
const SITE_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SITE_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OFFICER2_PROFILE_ID = '88888888-8888-4888-8888-888888888888';
const SUPERVISOR_PROFILE_ID = '99999999-9999-4999-8999-999999999999';
const SITE_LAT = 8.4657;
const SITE_LNG = -13.2317;

describe('Patrol Phase 6 (e2e)', () => {
  jest.setTimeout(120_000);
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const runId = Date.now();
  const createdRouteIds: string[] = [];
  const createdCheckpointIds: string[] = [];
  const createdDeviceIds: string[] = [];
  const createdShiftIds: string[] = [];
  const createdAssignmentIds: string[] = [];
  const createdAttendanceIds: string[] = [];
  const createdPatrolAssignmentIds: string[] = [];
  const createdIdempotencyKeys: string[] = [];
  let originalSiteASelfie: boolean | null = null;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.use(
      (
        req: Parameters<RequestIdMiddleware['use']>[0],
        res: Parameters<RequestIdMiddleware['use']>[1],
        next: NextFunction,
      ) => {
        new RequestIdMiddleware().use(req, res, next);
      },
    );

    const swaggerConfig = new DocumentBuilder()
      .setTitle('GuardTrak API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );

    await app.init();
    prisma = app.get(PrismaService);

    const siteA = await prisma.securitySite.findUnique({
      where: { id: SITE_A },
    });
    if (siteA) {
      originalSiteASelfie = siteA.requiresClockInSelfie;
      await prisma.securitySite.update({
        where: { id: SITE_A },
        data: { requiresClockInSelfie: false },
      });
    }
  });

  afterAll(async () => {
    if (originalSiteASelfie !== null) {
      await prisma.securitySite.update({
        where: { id: SITE_A },
        data: { requiresClockInSelfie: originalSiteASelfie },
      });
    }

    const patrolIds = [...createdPatrolAssignmentIds];
    if (createdRouteIds.length) {
      const byRoute = await prisma.patrolAssignment.findMany({
        where: { patrolRouteId: { in: createdRouteIds } },
        select: { id: true },
      });
      for (const row of byRoute) {
        if (!patrolIds.includes(row.id)) {
          patrolIds.push(row.id);
        }
      }
    }

    if (patrolIds.length) {
      await prisma.patrolVisit.deleteMany({
        where: { patrolAssignmentId: { in: patrolIds } },
      });
      await prisma.patrolAssignmentEvent.deleteMany({
        where: { patrolAssignmentId: { in: patrolIds } },
      });
      await prisma.patrolAssignmentCheckpoint.deleteMany({
        where: { patrolAssignmentId: { in: patrolIds } },
      });
      await prisma.patrolAssignment.deleteMany({
        where: { id: { in: patrolIds } },
      });
    }

    if (createdCheckpointIds.length) {
      await prisma.patrolVisit.deleteMany({
        where: { patrolCheckpointId: { in: createdCheckpointIds } },
      });
      await prisma.patrolAssignmentCheckpoint.deleteMany({
        where: { sourceCheckpointId: { in: createdCheckpointIds } },
      });
      await prisma.patrolCheckpoint.deleteMany({
        where: { id: { in: createdCheckpointIds } },
      });
    }

    if (createdRouteIds.length) {
      await prisma.patrolRoute.deleteMany({
        where: { id: { in: createdRouteIds } },
      });
    }

    if (createdAttendanceIds.length) {
      await prisma.attendanceEvent.deleteMany({
        where: { attendanceId: { in: createdAttendanceIds } },
      });
      await prisma.attendance.deleteMany({
        where: { id: { in: createdAttendanceIds } },
      });
    }

    if (createdAssignmentIds.length) {
      await prisma.assignmentEvent.deleteMany({
        where: { assignmentId: { in: createdAssignmentIds } },
      });
      await prisma.assignment.deleteMany({
        where: { id: { in: createdAssignmentIds } },
      });
    }

    if (createdShiftIds.length) {
      await prisma.shift.deleteMany({ where: { id: { in: createdShiftIds } } });
    }

    if (createdIdempotencyKeys.length) {
      await prisma.idempotencyRecord.deleteMany({
        where: { key: { in: createdIdempotencyKeys } },
      });
    }

    if (createdDeviceIds.length) {
      await prisma.refreshSession.deleteMany({
        where: { deviceId: { in: createdDeviceIds } },
      });
      await prisma.device.deleteMany({
        where: { id: { in: createdDeviceIds } },
      });
    }

    await app.close();
  });

  async function login(employeeId: string, suffix: string) {
    const installationId = `p6-${runId}-${suffix}-${employeeId}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        organisationCode: 'FOLPS',
        employeeId,
        password: PASSWORD,
        installationId,
        platform: 'ANDROID',
        deviceName: 'Phase6 E2E',
        appVersion: '1.0.0-e2e',
      })
      .expect(200);

    const device = await prisma.device.findUnique({
      where: { installationId },
    });
    if (device) {
      createdDeviceIds.push(device.id);
    }

    const body = asSuccessBody<{ accessToken: string; user: { id: string } }>(
      res.body,
    );
    return {
      accessToken: body.data.accessToken,
      userId: body.data.user.id,
      deviceId: device?.id,
    };
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  function assertNoQrSecrets(payload: unknown): void {
    const json = JSON.stringify(payload);
    expect(json).not.toMatch(/"qrCodeValue"/i);
    expect(json).not.toMatch(/"qrCodeHash"/i);
  }

  async function clearOfficerSchedule(officerId: string) {
    await prisma.shiftBreak.updateMany({
      where: { officerId, status: 'ACTIVE' },
      data: { status: 'CANCELLED', cancellationReason: 'e2e cleanup' },
    });
    await prisma.attendance.updateMany({
      where: {
        officerId,
        status: {
          in: [
            'CLOCKED_IN',
            'PENDING_SUPERVISOR_APPROVAL',
            'APPROVED_WITH_WARNING',
            'SUPERVISOR_APPROVED',
          ],
        },
      },
      data: { status: 'CLOCKED_OUT', clockOutServerAt: new Date() },
    });
    await prisma.assignment.updateMany({
      where: {
        officerId,
        status: { in: ['ASSIGNED', 'CONFIRMED', 'IN_PROGRESS'] },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: 'e2e cleanup',
      },
    });
  }

  async function createDraftRoute(
    adminToken: string,
    name: string,
    siteId = SITE_A,
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/patrol-routes')
      .set(auth(adminToken))
      .send({
        siteId,
        name,
        description: 'Phase 6 e2e',
        estimatedDurationMinutes: 20,
      })
      .expect(201);
    assertNoQrSecrets(res.body);
    const id = asSuccessBody<{ id: string }>(res.body).data.id;
    createdRouteIds.push(id);
    return id;
  }

  async function createCheckpoint(
    adminToken: string,
    routeId: string,
    body: Record<string, unknown>,
  ) {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/patrol-routes/${routeId}/checkpoints`)
      .set(auth(adminToken))
      .send(body)
      .expect(201);
    assertNoQrSecrets(res.body);
    const data = asSuccessBody<{ id: string; qrRequired: boolean }>(
      res.body,
    ).data;
    createdCheckpointIds.push(data.id);
    return data;
  }

  describe('auth and smoke', () => {
    it('rejects unauthenticated patrol route create with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/patrol-routes')
        .send({ siteId: SITE_A, name: `Unauth ${runId}` })
        .expect(401);
    });

    it('existing auth login still works', async () => {
      const admin = await login('ADM-001', 'login-ok');
      expect(admin.accessToken).toBeTruthy();
    });

    it('officer cannot create a patrol route', async () => {
      const officer = await login('OFF-001', 'no-route');
      const res = await request(app.getHttpServer())
        .post('/api/v1/patrol-routes')
        .set(auth(officer.accessToken))
        .send({ siteId: SITE_A, name: `Officer Route ${runId}` })
        .expect(403);
      expect(asErrorBody(res.body).success).toBe(false);
    });

    it('health and ready endpoints remain available', async () => {
      const health = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
      expect(asSuccessBody(health.body).success).toBe(true);

      const ready = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);
      expect(asSuccessBody(ready.body).success).toBe(true);
    });

    it('Swagger /docs is accessible', async () => {
      const res = await request(app.getHttpServer()).get('/docs').expect(200);
      expect(res.text).toMatch(/swagger|openapi|GuardTrak/i);
    });
  });

  describe('routes and checkpoints', () => {
    it('cannot activate route without checkpoints (409)', async () => {
      const admin = await login('ADM-001', 'no-cp');
      const routeId = await createDraftRoute(
        admin.accessToken,
        `Empty Route ${runId}`,
      );
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/patrol-routes/${routeId}/status`)
        .set(auth(admin.accessToken))
        .send({ status: 'ACTIVE' })
        .expect(409);
      expect(asErrorBody(res.body).code).toBe(
        'PATROL_ROUTE_HAS_NO_CHECKPOINTS',
      );
      assertNoQrSecrets(res.body);
    });

    it('duplicate sequence returns 409', async () => {
      const admin = await login('ADM-001', 'dup-seq');
      const routeId = await createDraftRoute(
        admin.accessToken,
        `Dup Seq Route ${runId}`,
      );
      await createCheckpoint(admin.accessToken, routeId, {
        name: 'A',
        sequence: 1,
        latitude: SITE_LAT,
        longitude: SITE_LNG,
        allowedRadiusMeters: 30,
        verificationMethod: 'GPS',
      });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/patrol-routes/${routeId}/checkpoints`)
        .set(auth(admin.accessToken))
        .send({
          name: 'B',
          sequence: 1,
          latitude: SITE_LAT,
          longitude: SITE_LNG,
          allowedRadiusMeters: 30,
          verificationMethod: 'GPS',
        })
        .expect(409);
      expect(asErrorBody(res.body).code).toBe(
        'PATROL_CHECKPOINT_SEQUENCE_CONFLICT',
      );
    });

    it('duplicate QR returns 409', async () => {
      const admin = await login('ADM-001', 'dup-qr');
      const routeId = await createDraftRoute(
        admin.accessToken,
        `Dup QR Route ${runId}`,
      );
      const qr = `GT-E2E-DUP-${runId}`;
      await createCheckpoint(admin.accessToken, routeId, {
        name: 'QR1',
        sequence: 1,
        latitude: SITE_LAT,
        longitude: SITE_LNG,
        allowedRadiusMeters: 30,
        verificationMethod: 'QR_CODE',
        qrCodeValue: qr,
      });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/patrol-routes/${routeId}/checkpoints`)
        .set(auth(admin.accessToken))
        .send({
          name: 'QR2',
          sequence: 2,
          latitude: SITE_LAT + 0.0001,
          longitude: SITE_LNG,
          allowedRadiusMeters: 30,
          verificationMethod: 'QR_CODE',
          qrCodeValue: qr,
        })
        .expect(409);
      expect(asErrorBody(res.body).code).toBe('PATROL_CHECKPOINT_QR_CONFLICT');
    });

    it('reorder checkpoints succeeds', async () => {
      const admin = await login('ADM-001', 'reorder');
      const routeId = await createDraftRoute(
        admin.accessToken,
        `Reorder Route ${runId}`,
      );
      const cp1 = await createCheckpoint(admin.accessToken, routeId, {
        name: 'First',
        sequence: 1,
        latitude: SITE_LAT,
        longitude: SITE_LNG,
        allowedRadiusMeters: 30,
        verificationMethod: 'GPS',
      });
      const cp2 = await createCheckpoint(admin.accessToken, routeId, {
        name: 'Second',
        sequence: 2,
        latitude: SITE_LAT + 0.0002,
        longitude: SITE_LNG,
        allowedRadiusMeters: 30,
        verificationMethod: 'GPS',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/patrol-routes/${routeId}/checkpoints/reorder`)
        .set(auth(admin.accessToken))
        .send({
          checkpoints: [
            { checkpointId: cp2.id, sequence: 1 },
            { checkpointId: cp1.id, sequence: 2 },
          ],
        })
        .expect(201);
      assertNoQrSecrets(res.body);
      const listed = asSuccessBody<Array<{ id: string; sequence: number }>>(
        res.body,
      ).data;
      expect(listed.find((c) => c.id === cp2.id)?.sequence).toBe(1);
      expect(listed.find((c) => c.id === cp1.id)?.sequence).toBe(2);
    });

    it('archive route returns 204', async () => {
      const admin = await login('ADM-001', 'archive');
      const routeId = await createDraftRoute(
        admin.accessToken,
        `Archive Route ${runId}`,
      );
      await createCheckpoint(admin.accessToken, routeId, {
        name: 'Only',
        sequence: 1,
        latitude: SITE_LAT,
        longitude: SITE_LNG,
        allowedRadiusMeters: 30,
        verificationMethod: 'GPS',
      });
      await request(app.getHttpServer())
        .delete(`/api/v1/patrol-routes/${routeId}`)
        .set(auth(admin.accessToken))
        .expect(204);
    });

    it('admin creates route + checkpoints + activates; QR secrets never returned', async () => {
      const admin = await login('ADM-001', 'activate');
      const qrSecret = `GT-E2E-ACT-${runId}`;
      const routeId = await createDraftRoute(
        admin.accessToken,
        `Activate Route ${runId}`,
      );
      await createCheckpoint(admin.accessToken, routeId, {
        name: 'Gate',
        sequence: 1,
        latitude: SITE_LAT,
        longitude: SITE_LNG,
        allowedRadiusMeters: 40,
        verificationMethod: 'GPS',
      });
      const cp2 = await createCheckpoint(admin.accessToken, routeId, {
        name: 'Bay',
        sequence: 2,
        latitude: SITE_LAT + 0.0001,
        longitude: SITE_LNG,
        allowedRadiusMeters: 40,
        verificationMethod: 'GPS_AND_QR',
        qrCodeValue: qrSecret,
      });
      expect(cp2.qrRequired).toBe(true);

      const activated = await request(app.getHttpServer())
        .patch(`/api/v1/patrol-routes/${routeId}/status`)
        .set(auth(admin.accessToken))
        .send({ status: 'ACTIVE' })
        .expect(200);
      assertNoQrSecrets(activated.body);
      expect(
        asSuccessBody<{ status: string }>(activated.body).data.status,
      ).toBe('ACTIVE');

      const stored = await prisma.patrolCheckpoint.findUnique({
        where: { id: cp2.id },
      });
      expect(stored?.qrCodeHash).toBeTruthy();
      expect(stored?.qrCodeHash).not.toEqual(qrSecret);
    });
  });

  describe('assignments, visits, completion, cancel', () => {
    it('full officer patrol flow with verification and idempotency', async () => {
      const admin = await login('ADM-001', 'flow-admin');
      const officer = await login('OFF-002', 'flow-off');
      const other = await login('OFF-001', 'flow-other');
      await clearOfficerSchedule(OFFICER2_PROFILE_ID);

      const qrSecret = `GT-E2E-FLOW-${runId}`;
      const routeId = await createDraftRoute(
        admin.accessToken,
        `Flow Route ${runId}`,
      );
      const cpGps = await createCheckpoint(admin.accessToken, routeId, {
        name: 'Front',
        sequence: 1,
        latitude: SITE_LAT,
        longitude: SITE_LNG,
        allowedRadiusMeters: 50,
        verificationMethod: 'GPS',
      });
      const cpQr = await createCheckpoint(admin.accessToken, routeId, {
        name: 'Fence',
        sequence: 2,
        latitude: SITE_LAT + 0.00015,
        longitude: SITE_LNG,
        allowedRadiusMeters: 50,
        verificationMethod: 'QR_CODE',
        qrCodeValue: qrSecret,
      });
      await createCheckpoint(admin.accessToken, routeId, {
        name: 'Yard',
        sequence: 3,
        latitude: SITE_LAT + 0.00025,
        longitude: SITE_LNG,
        allowedRadiusMeters: 50,
        verificationMethod: 'GPS',
      });

      const activateRes = await request(app.getHttpServer())
        .patch(`/api/v1/patrol-routes/${routeId}/status`)
        .set(auth(admin.accessToken))
        .send({ status: 'ACTIVE' })
        .expect(200);
      assertNoQrSecrets(activateRes.body);

      const start = new Date(Date.now() - 10 * 60 * 1000);
      const end = new Date(Date.now() + 6 * 60 * 60 * 1000);
      const shiftRes = await request(app.getHttpServer())
        .post('/api/v1/shifts')
        .set(auth(admin.accessToken))
        .send({
          siteId: SITE_A,
          title: `P6 shift ${runId}`,
          scheduledStartAt: start.toISOString(),
          scheduledEndAt: end.toISOString(),
        })
        .expect(201);
      const shiftId = asSuccessBody<{ id: string }>(shiftRes.body).data.id;
      createdShiftIds.push(shiftId);

      const assignRes = await request(app.getHttpServer())
        .post('/api/v1/assignments')
        .set(auth(admin.accessToken))
        .send({
          shiftId,
          officerId: OFFICER2_PROFILE_ID,
          supervisorId: SUPERVISOR_PROFILE_ID,
        })
        .expect(201);
      const assignmentId = asSuccessBody<{ id: string }>(assignRes.body).data
        .id;
      createdAssignmentIds.push(assignmentId);

      const mismatchRouteId = await createDraftRoute(
        admin.accessToken,
        `Mismatch Route ${runId}`,
        SITE_B,
      );
      await createCheckpoint(admin.accessToken, mismatchRouteId, {
        name: 'Remote',
        sequence: 1,
        latitude: 8.48,
        longitude: -13.24,
        allowedRadiusMeters: 40,
        verificationMethod: 'GPS',
      });
      await request(app.getHttpServer())
        .patch(`/api/v1/patrol-routes/${mismatchRouteId}/status`)
        .set(auth(admin.accessToken))
        .send({ status: 'ACTIVE' })
        .expect(200);

      const mismatch = await request(app.getHttpServer())
        .post('/api/v1/patrol-assignments')
        .set(auth(admin.accessToken))
        .send({
          patrolRouteId: mismatchRouteId,
          assignmentId,
        })
        .expect(409);
      expect(asErrorBody(mismatch.body).code).toBe(
        'PATROL_ASSIGNMENT_SITE_MISMATCH',
      );

      const patrolCreate = await request(app.getHttpServer())
        .post('/api/v1/patrol-assignments')
        .set(auth(admin.accessToken))
        .send({
          patrolRouteId: routeId,
          assignmentId,
          scheduledStartAt: start.toISOString(),
          scheduledEndAt: end.toISOString(),
        })
        .expect(201);
      assertNoQrSecrets(patrolCreate.body);
      const patrol = asSuccessBody<{
        id: string;
        status: string;
        checkpoints?: Array<{ id: string; sequence: number }>;
        totalCheckpointCount: number;
      }>(patrolCreate.body).data;
      createdPatrolAssignmentIds.push(patrol.id);
      expect(patrol.status).toBe('NOT_STARTED');
      expect(patrol.totalCheckpointCount).toBe(3);
      expect(patrol.checkpoints?.length).toBe(3);

      const snapBySeq = new Map(
        (patrol.checkpoints ?? []).map((c) => [c.sequence, c.id]),
      );

      const current = await request(app.getHttpServer())
        .get('/api/v1/patrol-assignments/current')
        .set(auth(officer.accessToken))
        .expect(200);
      assertNoQrSecrets(current.body);
      expect(asSuccessBody<{ id: string } | null>(current.body).data?.id).toBe(
        patrol.id,
      );

      const upcoming = await request(app.getHttpServer())
        .get('/api/v1/patrol-assignments/upcoming')
        .set(auth(officer.accessToken))
        .expect(200);
      assertNoQrSecrets(upcoming.body);

      const foreign = await request(app.getHttpServer())
        .get(`/api/v1/patrol-assignments/${patrol.id}`)
        .set(auth(other.accessToken))
        .expect(404);
      expect(asErrorBody(foreign.body).success).toBe(false);

      // Ensure patrol still NOT_STARTED before attendance check
      await prisma.patrolAssignment.update({
        where: { id: patrol.id },
        data: { status: 'NOT_STARTED', startedAt: null, startedAtDevice: null },
      });

      const noAttend = await request(app.getHttpServer())
        .post(`/api/v1/patrol-assignments/${patrol.id}/start`)
        .set(auth(officer.accessToken))
        .send({
          deviceTimestamp: new Date().toISOString(),
          idempotencyKey: `start-noatt-${runId}`,
        })
        .expect(409);
      createdIdempotencyKeys.push(`start-noatt-${runId}`);
      expect(asErrorBody(noAttend.body).code).toBe(
        'PATROL_ASSIGNMENT_ATTENDANCE_REQUIRED',
      );

      const clockKey = `p6-clock-${runId}`;
      createdIdempotencyKeys.push(clockKey);
      const clockIn = await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set(auth(officer.accessToken))
        .send({
          assignmentId,
          deviceTimestamp: new Date().toISOString(),
          latitude: SITE_LAT,
          longitude: SITE_LNG,
          accuracyMeters: 12,
          idempotencyKey: clockKey,
        })
        .expect(201);
      createdAttendanceIds.push(
        asSuccessBody<{ id: string }>(clockIn.body).data.id,
      );

      const startKey = `p6-start-${runId}`;
      createdIdempotencyKeys.push(startKey);
      const started = await request(app.getHttpServer())
        .post(`/api/v1/patrol-assignments/${patrol.id}/start`)
        .set(auth(officer.accessToken))
        .send({
          deviceTimestamp: new Date().toISOString(),
          idempotencyKey: startKey,
        })
        .expect(201);
      assertNoQrSecrets(started.body);
      expect(asSuccessBody<{ status: string }>(started.body).data.status).toBe(
        'IN_PROGRESS',
      );

      const outsideKey = `p6-out-${runId}`;
      createdIdempotencyKeys.push(outsideKey);
      const outside = await request(app.getHttpServer())
        .post(
          `/api/v1/patrol-assignments/${patrol.id}/checkpoints/${snapBySeq.get(1)}/visit`,
        )
        .set(auth(officer.accessToken))
        .send({
          verificationMethod: 'GPS',
          deviceTimestamp: new Date().toISOString(),
          latitude: 9.0,
          longitude: -12.0,
          accuracyMeters: 10,
          idempotencyKey: outsideKey,
        })
        .expect(409);
      expect(asErrorBody(outside.body).code).toBe(
        'PATROL_VISIT_OUTSIDE_GEOFENCE',
      );

      const oooKey = `p6-ooo-${runId}`;
      createdIdempotencyKeys.push(oooKey);
      const outOfOrder = await request(app.getHttpServer())
        .post(
          `/api/v1/patrol-assignments/${patrol.id}/checkpoints/${snapBySeq.get(2)}/visit`,
        )
        .set(auth(officer.accessToken))
        .send({
          verificationMethod: 'QR_CODE',
          deviceTimestamp: new Date().toISOString(),
          latitude: SITE_LAT,
          longitude: SITE_LNG,
          accuracyMeters: 10,
          qrCodeValue: qrSecret,
          idempotencyKey: oooKey,
        })
        .expect(409);
      expect(asErrorBody(outOfOrder.body).code).toBe(
        'PATROL_CHECKPOINT_OUT_OF_ORDER',
      );

      const visit1Key = `p6-v1-${runId}`;
      createdIdempotencyKeys.push(visit1Key);
      const visit1Ts = new Date().toISOString();
      const visit1Payload = {
        verificationMethod: 'GPS' as const,
        deviceTimestamp: visit1Ts,
        latitude: SITE_LAT,
        longitude: SITE_LNG,
        accuracyMeters: 10,
        localVisitId: `local-v1-${runId}`,
        idempotencyKey: visit1Key,
      };
      const visit1 = await request(app.getHttpServer())
        .post(
          `/api/v1/patrol-assignments/${patrol.id}/checkpoints/${cpGps.id}/visit`,
        )
        .set(auth(officer.accessToken))
        .send(visit1Payload)
        .expect(201);
      assertNoQrSecrets(visit1.body);
      const visit1Id = asSuccessBody<{ id: string; status: string }>(
        visit1.body,
      ).data.id;
      expect(asSuccessBody<{ status: string }>(visit1.body).data.status).toBe(
        'COMPLETED',
      );

      const visit1Replay = await request(app.getHttpServer())
        .post(
          `/api/v1/patrol-assignments/${patrol.id}/checkpoints/${cpGps.id}/visit`,
        )
        .set(auth(officer.accessToken))
        .send(visit1Payload)
        .expect(201);
      assertNoQrSecrets(visit1Replay.body);
      expect(asSuccessBody<{ id: string }>(visit1Replay.body).data.id).toBe(
        visit1Id,
      );

      const dupKey = `p6-dup-${runId}`;
      createdIdempotencyKeys.push(dupKey);
      const dupVisit = await request(app.getHttpServer())
        .post(
          `/api/v1/patrol-assignments/${patrol.id}/checkpoints/${snapBySeq.get(1)}/visit`,
        )
        .set(auth(officer.accessToken))
        .send({
          verificationMethod: 'GPS',
          deviceTimestamp: new Date().toISOString(),
          latitude: SITE_LAT,
          longitude: SITE_LNG,
          accuracyMeters: 10,
          idempotencyKey: dupKey,
        })
        .expect(409);
      expect(asErrorBody(dupVisit.body).code).toBe(
        'PATROL_CHECKPOINT_ALREADY_COMPLETED',
      );

      const badQrKey = `p6-badqr-${runId}`;
      createdIdempotencyKeys.push(badQrKey);
      const badQr = await request(app.getHttpServer())
        .post(
          `/api/v1/patrol-assignments/${patrol.id}/checkpoints/${cpQr.id}/visit`,
        )
        .set(auth(officer.accessToken))
        .send({
          verificationMethod: 'QR_CODE',
          deviceTimestamp: new Date().toISOString(),
          latitude: SITE_LAT,
          longitude: SITE_LNG,
          accuracyMeters: 10,
          qrCodeValue: 'WRONG-QR',
          idempotencyKey: badQrKey,
        })
        .expect(409);
      expect(asErrorBody(badQr.body).code).toBe('PATROL_VISIT_QR_INVALID');

      const goodQrKey = `p6-goodqr-${runId}`;
      createdIdempotencyKeys.push(goodQrKey);
      const goodQr = await request(app.getHttpServer())
        .post(
          `/api/v1/patrol-assignments/${patrol.id}/checkpoints/${cpQr.id}/visit`,
        )
        .set(auth(officer.accessToken))
        .send({
          verificationMethod: 'QR_CODE',
          deviceTimestamp: new Date().toISOString(),
          latitude: SITE_LAT,
          longitude: SITE_LNG,
          accuracyMeters: 10,
          qrCodeValue: qrSecret,
          idempotencyKey: goodQrKey,
        })
        .expect(201);
      assertNoQrSecrets(goodQr.body);
      expect(asSuccessBody<{ status: string }>(goodQr.body).data.status).toBe(
        'COMPLETED',
      );

      const earlyCompleteKey = `p6-early-complete-${runId}`;
      createdIdempotencyKeys.push(earlyCompleteKey);
      const blocked = await request(app.getHttpServer())
        .post(`/api/v1/patrol-assignments/${patrol.id}/complete`)
        .set(auth(officer.accessToken))
        .send({
          deviceTimestamp: new Date().toISOString(),
          idempotencyKey: earlyCompleteKey,
        })
        .expect(409);
      expect(asErrorBody(blocked.body).code).toBe(
        'PATROL_ASSIGNMENT_NOT_COMPLETE',
      );

      const visit3Key = `p6-v3-${runId}`;
      createdIdempotencyKeys.push(visit3Key);
      const visit3 = await request(app.getHttpServer())
        .post(
          `/api/v1/patrol-assignments/${patrol.id}/checkpoints/${snapBySeq.get(3)}/visit`,
        )
        .set(auth(officer.accessToken))
        .send({
          verificationMethod: 'GPS',
          deviceTimestamp: new Date().toISOString(),
          latitude: SITE_LAT + 0.00025,
          longitude: SITE_LNG,
          accuracyMeters: 10,
          idempotencyKey: visit3Key,
        })
        .expect(201);
      assertNoQrSecrets(visit3.body);

      const completeKey = `p6-complete-${runId}`;
      createdIdempotencyKeys.push(completeKey);
      const completed = await request(app.getHttpServer())
        .post(`/api/v1/patrol-assignments/${patrol.id}/complete`)
        .set(auth(officer.accessToken))
        .send({
          deviceTimestamp: new Date().toISOString(),
          finalNote: 'All clear',
          idempotencyKey: completeKey,
        })
        .expect(201);
      assertNoQrSecrets(completed.body);
      expect(
        asSuccessBody<{ status: string }>(completed.body).data.status,
      ).toBe('COMPLETED');

      // Cancel preserves visits on a separate NOT_STARTED→IN_PROGRESS patrol
      const cancelRouteId = await createDraftRoute(
        admin.accessToken,
        `Cancel Route ${runId}`,
      );
      await createCheckpoint(admin.accessToken, cancelRouteId, {
        name: 'Only CP',
        sequence: 1,
        latitude: SITE_LAT,
        longitude: SITE_LNG,
        allowedRadiusMeters: 50,
        verificationMethod: 'GPS',
      });
      await request(app.getHttpServer())
        .patch(`/api/v1/patrol-routes/${cancelRouteId}/status`)
        .set(auth(admin.accessToken))
        .send({ status: 'ACTIVE' })
        .expect(200);

      const shift2Start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const shift2End = new Date(shift2Start.getTime() + 6 * 60 * 60 * 1000);
      const shift2Res = await request(app.getHttpServer())
        .post('/api/v1/shifts')
        .set(auth(admin.accessToken))
        .send({
          siteId: SITE_A,
          title: `P6 cancel shift ${runId}`,
          scheduledStartAt: shift2Start.toISOString(),
          scheduledEndAt: shift2End.toISOString(),
        })
        .expect(201);
      const shift2Id = asSuccessBody<{ id: string }>(shift2Res.body).data.id;
      createdShiftIds.push(shift2Id);

      // Clock out first attendance so second assignment can clock in if needed;
      // for cancel test we start patrol on a fresh assignment with attendance.
      await clearOfficerSchedule(OFFICER2_PROFILE_ID);

      const assign2Res = await request(app.getHttpServer())
        .post('/api/v1/assignments')
        .set(auth(admin.accessToken))
        .send({
          shiftId: shift2Id,
          officerId: OFFICER2_PROFILE_ID,
          supervisorId: SUPERVISOR_PROFILE_ID,
        })
        .expect(201);
      const assignment2Id = asSuccessBody<{ id: string }>(assign2Res.body).data
        .id;
      createdAssignmentIds.push(assignment2Id);

      // Use near-now shift for start window + attendance
      await prisma.shift.update({
        where: { id: shift2Id },
        data: {
          scheduledStartAt: new Date(Date.now() - 5 * 60 * 1000),
          scheduledEndAt: new Date(Date.now() + 5 * 60 * 60 * 1000),
        },
      });

      const patrol2Create = await request(app.getHttpServer())
        .post('/api/v1/patrol-assignments')
        .set(auth(admin.accessToken))
        .send({
          patrolRouteId: cancelRouteId,
          assignmentId: assignment2Id,
        })
        .expect(201);
      assertNoQrSecrets(patrol2Create.body);
      const patrol2 = asSuccessBody<{
        id: string;
        checkpoints?: Array<{ id: string }>;
      }>(patrol2Create.body).data;
      createdPatrolAssignmentIds.push(patrol2.id);

      const clock2Key = `p6-clock2-${runId}`;
      createdIdempotencyKeys.push(clock2Key);
      const clock2 = await request(app.getHttpServer())
        .post('/api/v1/attendance/clock-in')
        .set(auth(officer.accessToken))
        .send({
          assignmentId: assignment2Id,
          deviceTimestamp: new Date().toISOString(),
          latitude: SITE_LAT,
          longitude: SITE_LNG,
          accuracyMeters: 12,
          idempotencyKey: clock2Key,
        })
        .expect(201);
      createdAttendanceIds.push(
        asSuccessBody<{ id: string }>(clock2.body).data.id,
      );

      const start2Key = `p6-start2-${runId}`;
      createdIdempotencyKeys.push(start2Key);
      await request(app.getHttpServer())
        .post(`/api/v1/patrol-assignments/${patrol2.id}/start`)
        .set(auth(officer.accessToken))
        .send({
          deviceTimestamp: new Date().toISOString(),
          idempotencyKey: start2Key,
        })
        .expect(201);

      const cancelVisitKey = `p6-cancel-visit-${runId}`;
      createdIdempotencyKeys.push(cancelVisitKey);
      const cancelVisit = await request(app.getHttpServer())
        .post(
          `/api/v1/patrol-assignments/${patrol2.id}/checkpoints/${patrol2.checkpoints?.[0].id}/visit`,
        )
        .set(auth(officer.accessToken))
        .send({
          verificationMethod: 'GPS',
          deviceTimestamp: new Date().toISOString(),
          latitude: SITE_LAT,
          longitude: SITE_LNG,
          accuracyMeters: 10,
          localVisitId: `local-cancel-${runId}`,
          idempotencyKey: cancelVisitKey,
        })
        .expect(201);
      assertNoQrSecrets(cancelVisit.body);
      const preservedVisitId = asSuccessBody<{ id: string }>(cancelVisit.body)
        .data.id;

      const cancelled = await request(app.getHttpServer())
        .post(`/api/v1/patrol-assignments/${patrol2.id}/cancel`)
        .set(auth(admin.accessToken))
        .send({ reason: 'Shift reassigned for e2e' })
        .expect(201);
      assertNoQrSecrets(cancelled.body);
      expect(
        asSuccessBody<{ status: string }>(cancelled.body).data.status,
      ).toBe('CANCELLED');

      const stillThere = await prisma.patrolVisit.findUnique({
        where: { id: preservedVisitId },
      });
      expect(stillThere).not.toBeNull();
      expect(stillThere?.patrolAssignmentId).toBe(patrol2.id);
    });
  });
});
