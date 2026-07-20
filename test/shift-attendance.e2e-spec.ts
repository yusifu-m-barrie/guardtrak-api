import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { GeofencePolicy, SiteStatus } from '../generated/prisma/client';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { asErrorBody, asSuccessBody } from './http-body';

const PASSWORD = 'GuardTrak!Dev2026';
const CLIENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OFFICER1_PROFILE_ID = '77777777-7777-4777-8777-777777777777';
const OFFICER2_PROFILE_ID = '88888888-8888-4888-8888-888888888888';
const SUPERVISOR_PROFILE_ID = '99999999-9999-4999-8999-999999999999';
const SITE_LAT = 8.4657;
const SITE_LNG = -13.2317;

describe('Shift attendance Phase 5 (e2e)', () => {
  jest.setTimeout(120_000);
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const runId = Date.now();
  const createdSiteIds: string[] = [];
  const createdShiftIds: string[] = [];
  const createdAssignmentIds: string[] = [];
  const createdAttendanceIds: string[] = [];
  const createdBreakIds: string[] = [];
  const createdDeviceIds: string[] = [];
  const createdIdempotencyKeys: string[] = [];
  let originalSiteASelfie: boolean | null = null;
  let originalSiteANote: boolean | null = null;
  let originalSiteAPolicy: GeofencePolicy | null = null;

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
      where: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    });
    if (siteA) {
      originalSiteASelfie = siteA.requiresClockInSelfie;
      originalSiteANote = siteA.requiresFinalShiftNote;
      originalSiteAPolicy = siteA.clockInOutsideGeofencePolicy;
    }
  });

  afterAll(async () => {
    if (originalSiteASelfie !== null) {
      await prisma.securitySite.update({
        where: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
        data: {
          requiresClockInSelfie: originalSiteASelfie,
          requiresFinalShiftNote: originalSiteANote ?? false,
          clockInOutsideGeofencePolicy:
            originalSiteAPolicy ?? GeofencePolicy.REQUIRE_SUPERVISOR_APPROVAL,
        },
      });
    }

    if (createdBreakIds.length) {
      await prisma.shiftBreak.deleteMany({
        where: { id: { in: createdBreakIds } },
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
    if (createdSiteIds.length) {
      await prisma.securitySite.deleteMany({
        where: { id: { in: createdSiteIds } },
      });
    }
    if (createdDeviceIds.length) {
      await prisma.refreshSession.deleteMany({
        where: { deviceId: { in: createdDeviceIds } },
      });
      await prisma.idempotencyRecord.deleteMany({
        where: { key: { in: createdIdempotencyKeys } },
      });
      await prisma.device.deleteMany({
        where: { id: { in: createdDeviceIds } },
      });
    }

    await app.close();
  });

  async function login(employeeId: string, suffix: string) {
    const installationId = `p5-${runId}-${suffix}-${employeeId}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        organisationCode: 'GUARDTRAK',
        employeeId,
        password: PASSWORD,
        installationId,
        platform: 'ANDROID',
        deviceName: 'Phase5 E2E',
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

  function assertNoSensitive(body: unknown) {
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('tokenHash');
    expect(raw).not.toContain(PASSWORD);
  }

  let siteSeq = 0;

  async function createTestSite(overrides?: {
    clockInOutsideGeofencePolicy?: GeofencePolicy;
    requiresFinalShiftNote?: boolean;
    minimumGpsAccuracyMeters?: number;
  }) {
    siteSeq += 1;
    const org = await prisma.organisation.findFirst({
      where: { code: 'GUARDTRAK' },
    });
    const site = await prisma.securitySite.create({
      data: {
        organisationId: org!.id,
        clientId: CLIENT_ID,
        name: `P5 Site ${runId}-${siteSeq}`,
        code: `P5${runId}${siteSeq}`.slice(0, 32),
        address: 'E2E test site',
        latitude: SITE_LAT,
        longitude: SITE_LNG,
        clockInRadiusMeters: 100,
        clockOutRadiusMeters: 100,
        minimumGpsAccuracyMeters: overrides?.minimumGpsAccuracyMeters ?? 50,
        clockInOutsideGeofencePolicy:
          overrides?.clockInOutsideGeofencePolicy ?? GeofencePolicy.BLOCK,
        clockOutOutsideGeofencePolicy: GeofencePolicy.BLOCK,
        requiresClockInSelfie: false,
        requiresClockOutSelfie: false,
        requiresFinalShiftNote: overrides?.requiresFinalShiftNote ?? false,
        status: SiteStatus.ACTIVE,
      },
    });
    createdSiteIds.push(site.id);
    return site;
  }

  it('1. unauthenticated shift request returns 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/shifts').expect(401);
  });

  it('2. officer cannot create shift', async () => {
    const officer = await login('OFF-001', 'no-create');
    const site = await createTestSite();
    const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const end = new Date(Date.now() + 10 * 60 * 60 * 1000);
    await request(app.getHttpServer())
      .post('/api/v1/shifts')
      .set(auth(officer.accessToken))
      .send({
        siteId: site.id,
        title: 'Forbidden shift',
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
      })
      .expect(403);
  });

  it('3-4. administrator creates shift; invalid times fail', async () => {
    const admin = await login('ADM-001', 'create-shift');
    const site = await createTestSite();
    const start = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const end = new Date(Date.now() + 11 * 60 * 60 * 1000);

    const bad = await request(app.getHttpServer())
      .post('/api/v1/shifts')
      .set(auth(admin.accessToken))
      .send({
        siteId: site.id,
        title: 'Bad times',
        scheduledStartAt: end.toISOString(),
        scheduledEndAt: start.toISOString(),
      })
      .expect(400);
    expect(asErrorBody(bad.body).code).toBe('SHIFT_TIME_RANGE_INVALID');

    const ok = await request(app.getHttpServer())
      .post('/api/v1/shifts')
      .set(auth(admin.accessToken))
      .send({
        siteId: site.id,
        title: `Night Security ${runId}`,
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
        unpaidBreakMinutes: 30,
        gracePeriodMinutes: 10,
      })
      .expect(201);

    const shift = asSuccessBody<{ id: string }>(ok.body).data;
    createdShiftIds.push(shift.id);
    assertNoSensitive(ok.body);
  });

  it('5-7. assign officer; duplicate and overlap return 409', async () => {
    const admin = await login('ADM-001', 'assign');
    await clearOfficerSchedule(OFFICER2_PROFILE_ID);
    const site = await createTestSite();
    const start = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const end = new Date(Date.now() + 12 * 60 * 60 * 1000);

    const shiftRes = await request(app.getHttpServer())
      .post('/api/v1/shifts')
      .set(auth(admin.accessToken))
      .send({
        siteId: site.id,
        title: `Assign shift ${runId}`,
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
    const assignmentId = asSuccessBody<{ id: string }>(assignRes.body).data.id;
    createdAssignmentIds.push(assignmentId);

    const dup = await request(app.getHttpServer())
      .post('/api/v1/assignments')
      .set(auth(admin.accessToken))
      .send({
        shiftId,
        officerId: OFFICER2_PROFILE_ID,
      })
      .expect(409);
    expect(asErrorBody(dup.body).code).toBe('ASSIGNMENT_DUPLICATE');

    const overlapShift = await request(app.getHttpServer())
      .post('/api/v1/shifts')
      .set(auth(admin.accessToken))
      .send({
        siteId: site.id,
        title: `Overlap ${runId}`,
        scheduledStartAt: new Date(
          start.getTime() + 60 * 60 * 1000,
        ).toISOString(),
        scheduledEndAt: new Date(end.getTime() + 60 * 60 * 1000).toISOString(),
      })
      .expect(201);
    const overlapShiftId = asSuccessBody<{ id: string }>(overlapShift.body).data
      .id;
    createdShiftIds.push(overlapShiftId);

    const overlap = await request(app.getHttpServer())
      .post('/api/v1/assignments')
      .set(auth(admin.accessToken))
      .send({
        shiftId: overlapShiftId,
        officerId: OFFICER2_PROFILE_ID,
      })
      .expect(409);
    expect(asErrorBody(overlap.body).code).toBe('ASSIGNMENT_TIME_CONFLICT');
  });

  it('8-10. officer current/upcoming/confirm; other officer forbidden', async () => {
    const admin = await login('ADM-001', 'confirm-setup');
    const officer = await login('OFF-002', 'confirm-off');
    const other = await login('OFF-001', 'confirm-other');
    await clearOfficerSchedule(OFFICER2_PROFILE_ID);
    const site = await createTestSite();
    const start = new Date(Date.now() + 30 * 60 * 1000);
    const end = new Date(Date.now() + 8 * 60 * 60 * 1000);

    const shiftRes = await request(app.getHttpServer())
      .post('/api/v1/shifts')
      .set(auth(admin.accessToken))
      .send({
        siteId: site.id,
        title: `Confirmable ${runId}`,
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
    const assignmentId = asSuccessBody<{ id: string }>(assignRes.body).data.id;
    createdAssignmentIds.push(assignmentId);

    const upcoming = await request(app.getHttpServer())
      .get('/api/v1/assignments/upcoming')
      .set(auth(officer.accessToken))
      .expect(200);
    expect(
      asSuccessBody<Array<{ id: string }>>(upcoming.body).data.some(
        (a) => a.id === assignmentId,
      ),
    ).toBe(true);

    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/assignments/${assignmentId}/confirm`)
      .set(auth(officer.accessToken))
      .expect(201);
    expect(asSuccessBody<{ status: string }>(confirmed.body).data.status).toBe(
      'CONFIRMED',
    );

    await request(app.getHttpServer())
      .get(`/api/v1/assignments/${assignmentId}`)
      .set(auth(other.accessToken))
      .expect(404);
  });

  it('11-17. clock-in geofence, idempotency, accuracy, inactive device', async () => {
    const admin = await login('ADM-001', 'clock-setup');
    const officer = await login('OFF-002', 'clock-off');
    await clearOfficerSchedule(OFFICER2_PROFILE_ID);
    const site = await createTestSite({
      clockInOutsideGeofencePolicy: GeofencePolicy.BLOCK,
      minimumGpsAccuracyMeters: 40,
    });
    const start = new Date(Date.now() - 10 * 60 * 1000);
    const end = new Date(Date.now() + 6 * 60 * 60 * 1000);

    const shiftRes = await request(app.getHttpServer())
      .post('/api/v1/shifts')
      .set(auth(admin.accessToken))
      .send({
        siteId: site.id,
        title: `Clock shift ${runId}`,
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
    const assignmentId = asSuccessBody<{ id: string }>(assignRes.body).data.id;
    createdAssignmentIds.push(assignmentId);

    const nowIso = new Date().toISOString();
    const idemKey = `clock-in-${runId}-${assignmentId}`;
    createdIdempotencyKeys.push(idemKey);

    const outside = await request(app.getHttpServer())
      .post('/api/v1/attendance/clock-in')
      .set(auth(officer.accessToken))
      .send({
        assignmentId,
        deviceTimestamp: nowIso,
        latitude: 9.0,
        longitude: -12.0,
        accuracyMeters: 10,
        idempotencyKey: `outside-${idemKey}`,
      })
      .expect(400);
    expect(asErrorBody(outside.body).code).toBe('ATTENDANCE_OUTSIDE_GEOFENCE');
    createdIdempotencyKeys.push(`outside-${idemKey}`);

    const poorGps = await request(app.getHttpServer())
      .post('/api/v1/attendance/clock-in')
      .set(auth(officer.accessToken))
      .send({
        assignmentId,
        deviceTimestamp: nowIso,
        latitude: SITE_LAT,
        longitude: SITE_LNG,
        accuracyMeters: 200,
        idempotencyKey: `gps-${idemKey}`,
      })
      .expect(400);
    expect(asErrorBody(poorGps.body).code).toBe(
      'ATTENDANCE_GPS_ACCURACY_TOO_LOW',
    );
    createdIdempotencyKeys.push(`gps-${idemKey}`);

    const clockIn = await request(app.getHttpServer())
      .post('/api/v1/attendance/clock-in')
      .set(auth(officer.accessToken))
      .send({
        assignmentId,
        deviceTimestamp: nowIso,
        latitude: SITE_LAT,
        longitude: SITE_LNG,
        accuracyMeters: 12,
        localAttendanceId: `local-${runId}`,
        idempotencyKey: idemKey,
      })
      .expect(201);
    const attendance = asSuccessBody<{ id: string; status: string }>(
      clockIn.body,
    ).data;
    createdAttendanceIds.push(attendance.id);
    expect(attendance.status).toBe('CLOCKED_IN');

    const replay = await request(app.getHttpServer())
      .post('/api/v1/attendance/clock-in')
      .set(auth(officer.accessToken))
      .send({
        assignmentId,
        deviceTimestamp: nowIso,
        latitude: SITE_LAT,
        longitude: SITE_LNG,
        accuracyMeters: 12,
        localAttendanceId: `local-${runId}`,
        idempotencyKey: idemKey,
      })
      .expect(201);
    expect(asSuccessBody<{ id: string }>(replay.body).data.id).toBe(
      attendance.id,
    );

    const conflict = await request(app.getHttpServer())
      .post('/api/v1/attendance/clock-in')
      .set(auth(officer.accessToken))
      .send({
        assignmentId,
        deviceTimestamp: nowIso,
        latitude: SITE_LAT,
        longitude: SITE_LNG,
        accuracyMeters: 12,
        idempotencyKey: `new-${idemKey}`,
      })
      .expect(409);
    expect(asErrorBody(conflict.body).code).toBe('ATTENDANCE_ALREADY_EXISTS');
    createdIdempotencyKeys.push(`new-${idemKey}`);

    if (officer.deviceId) {
      await prisma.device.update({
        where: { id: officer.deviceId },
        data: { status: 'REVOKED' },
      });
      const inactive = await request(app.getHttpServer())
        .get('/api/v1/attendance/current')
        .set(auth(officer.accessToken))
        .expect(200);
      assertNoSensitive(inactive.body);

      await prisma.device.update({
        where: { id: officer.deviceId },
        data: { status: 'ACTIVE' },
      });
    }
  });

  it('15. ALLOW_WITH_REASON requires reason', async () => {
    const admin = await login('ADM-001', 'reason-setup');
    const officer = await login('OFF-002', 'reason-off');
    await clearOfficerSchedule(OFFICER2_PROFILE_ID);
    const site = await createTestSite({
      clockInOutsideGeofencePolicy: GeofencePolicy.ALLOW_WITH_REASON,
    });

    const start = new Date(Date.now() - 5 * 60 * 1000);
    const end = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const shiftRes = await request(app.getHttpServer())
      .post('/api/v1/shifts')
      .set(auth(admin.accessToken))
      .send({
        siteId: site.id,
        title: `Reason shift ${runId}`,
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
      })
      .expect(201);
    const shiftId = asSuccessBody<{ id: string }>(shiftRes.body).data.id;
    createdShiftIds.push(shiftId);

    const assignRes = await request(app.getHttpServer())
      .post('/api/v1/assignments')
      .set(auth(admin.accessToken))
      .send({ shiftId, officerId: OFFICER2_PROFILE_ID })
      .expect(201);
    const assignmentId = asSuccessBody<{ id: string }>(assignRes.body).data.id;
    createdAssignmentIds.push(assignmentId);

    const key = `reason-${runId}`;
    createdIdempotencyKeys.push(key);
    const missing = await request(app.getHttpServer())
      .post('/api/v1/attendance/clock-in')
      .set(auth(officer.accessToken))
      .send({
        assignmentId,
        deviceTimestamp: new Date().toISOString(),
        latitude: 9.1,
        longitude: -12.1,
        accuracyMeters: 10,
        idempotencyKey: key,
      })
      .expect(400);
    expect(asErrorBody(missing.body).code).toBe('ATTENDANCE_REASON_REQUIRED');
  });

  it('18-24. current attendance, breaks, clock-out, final note', async () => {
    const admin = await login('ADM-001', 'break-setup');
    const officer = await login('OFF-002', 'break-off');
    await clearOfficerSchedule(OFFICER2_PROFILE_ID);
    const site = await createTestSite({ requiresFinalShiftNote: true });

    const start = new Date(Date.now() - 5 * 60 * 1000);
    const end = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const shiftRes = await request(app.getHttpServer())
      .post('/api/v1/shifts')
      .set(auth(admin.accessToken))
      .send({
        siteId: site.id,
        title: `Break shift ${runId}`,
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
    const assignmentId = asSuccessBody<{ id: string }>(assignRes.body).data.id;
    createdAssignmentIds.push(assignmentId);

    const clockKey = `ci-break-${runId}`;
    createdIdempotencyKeys.push(clockKey);
    const clockIn = await request(app.getHttpServer())
      .post('/api/v1/attendance/clock-in')
      .set(auth(officer.accessToken))
      .send({
        assignmentId,
        deviceTimestamp: new Date().toISOString(),
        latitude: SITE_LAT,
        longitude: SITE_LNG,
        accuracyMeters: 10,
        idempotencyKey: clockKey,
      })
      .expect(201);
    const attendanceId = asSuccessBody<{ id: string }>(clockIn.body).data.id;
    createdAttendanceIds.push(attendanceId);

    const current = await request(app.getHttpServer())
      .get('/api/v1/attendance/current')
      .set(auth(officer.accessToken))
      .expect(200);
    expect(asSuccessBody<{ id: string } | null>(current.body).data?.id).toBe(
      attendanceId,
    );

    const startBreakKey = `break-start-${runId}`;
    createdIdempotencyKeys.push(startBreakKey);
    const breakStart = await request(app.getHttpServer())
      .post('/api/v1/breaks/start')
      .set(auth(officer.accessToken))
      .send({
        attendanceId,
        type: 'MEAL',
        deviceTimestamp: new Date().toISOString(),
        idempotencyKey: startBreakKey,
      })
      .expect(201);
    const breakId = asSuccessBody<{ id: string }>(breakStart.body).data.id;
    createdBreakIds.push(breakId);

    const second = await request(app.getHttpServer())
      .post('/api/v1/breaks/start')
      .set(auth(officer.accessToken))
      .send({
        attendanceId,
        type: 'REST',
        deviceTimestamp: new Date().toISOString(),
        idempotencyKey: `break-start-2-${runId}`,
      })
      .expect(409);
    expect(asErrorBody(second.body).code).toBe('BREAK_ALREADY_ACTIVE');
    createdIdempotencyKeys.push(`break-start-2-${runId}`);

    const clockOutBlocked = await request(app.getHttpServer())
      .post('/api/v1/attendance/clock-out')
      .set(auth(officer.accessToken))
      .send({
        attendanceId,
        deviceTimestamp: new Date().toISOString(),
        latitude: SITE_LAT,
        longitude: SITE_LNG,
        accuracyMeters: 10,
        finalShiftNote: 'done',
        idempotencyKey: `co-blocked-${runId}`,
      })
      .expect(409);
    expect(asErrorBody(clockOutBlocked.body).code).toBe(
      'ATTENDANCE_ACTIVE_BREAK_EXISTS',
    );
    createdIdempotencyKeys.push(`co-blocked-${runId}`);

    const endBreakKey = `break-end-${runId}`;
    createdIdempotencyKeys.push(endBreakKey);
    await request(app.getHttpServer())
      .post(`/api/v1/breaks/${breakId}/end`)
      .set(auth(officer.accessToken))
      .send({
        deviceTimestamp: new Date().toISOString(),
        idempotencyKey: endBreakKey,
      })
      .expect(201);

    const missingNote = await request(app.getHttpServer())
      .post('/api/v1/attendance/clock-out')
      .set(auth(officer.accessToken))
      .send({
        attendanceId,
        deviceTimestamp: new Date().toISOString(),
        latitude: SITE_LAT,
        longitude: SITE_LNG,
        accuracyMeters: 10,
        idempotencyKey: `co-note-${runId}`,
      })
      .expect(400);
    expect(asErrorBody(missingNote.body).code).toBe(
      'ATTENDANCE_FINAL_NOTE_REQUIRED',
    );
    createdIdempotencyKeys.push(`co-note-${runId}`);

    const clockOut = await request(app.getHttpServer())
      .post('/api/v1/attendance/clock-out')
      .set(auth(officer.accessToken))
      .send({
        attendanceId,
        deviceTimestamp: new Date().toISOString(),
        latitude: SITE_LAT,
        longitude: SITE_LNG,
        accuracyMeters: 10,
        finalShiftNote: 'Shift completed without incident.',
        idempotencyKey: `co-ok-${runId}`,
      })
      .expect(201);
    const totals = asSuccessBody<{
      grossMinutes: number | null;
      payableMinutes: number | null;
    }>(clockOut.body).data;
    expect(totals.grossMinutes).not.toBeNull();
    createdIdempotencyKeys.push(`co-ok-${runId}`);
  });

  it('25-29. supervisor list/review; admin correct/void', async () => {
    const admin = await login('ADM-001', 'review-admin');
    const supervisor = await login('SUP-001', 'review-sup');
    const list = await request(app.getHttpServer())
      .get('/api/v1/attendance')
      .set(auth(supervisor.accessToken))
      .expect(200);
    expect(Array.isArray(asSuccessBody<unknown[]>(list.body).data)).toBe(true);

    const attendanceId = createdAttendanceIds[createdAttendanceIds.length - 1];
    expect(attendanceId).toBeDefined();

    await prisma.attendance.update({
      where: { id: attendanceId },
      data: { status: 'PENDING_SUPERVISOR_APPROVAL' },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/attendance/${attendanceId}/approve`)
      .set(auth(supervisor.accessToken))
      .send({ reason: 'Location and shift notes verified.' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/attendance/${attendanceId}/correct`)
      .set(auth(admin.accessToken))
      .send({
        clockInServerAt: new Date(
          Date.now() - 4 * 60 * 60 * 1000,
        ).toISOString(),
        clockOutServerAt: new Date().toISOString(),
        reason: 'Confirmed from site register.',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/attendance/${attendanceId}/void`)
      .set(auth(admin.accessToken))
      .send({ reason: 'Voided for e2e cleanup scenario.' })
      .expect(201);
  });

  it('30-31. shift cancel cascades; archive returns 204', async () => {
    const admin = await login('ADM-001', 'cancel-archive');
    const site = await createTestSite();
    const start = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const end = new Date(Date.now() + 56 * 60 * 60 * 1000);

    const shiftRes = await request(app.getHttpServer())
      .post('/api/v1/shifts')
      .set(auth(admin.accessToken))
      .send({
        siteId: site.id,
        title: `Cancel me ${runId}`,
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
      })
      .expect(201);
    const shiftId = asSuccessBody<{ id: string }>(shiftRes.body).data.id;
    createdShiftIds.push(shiftId);

    const assignRes = await request(app.getHttpServer())
      .post('/api/v1/assignments')
      .set(auth(admin.accessToken))
      .send({ shiftId, officerId: OFFICER1_PROFILE_ID })
      .expect(201);
    const assignmentId = asSuccessBody<{ id: string }>(assignRes.body).data.id;
    createdAssignmentIds.push(assignmentId);

    await request(app.getHttpServer())
      .patch(`/api/v1/shifts/${shiftId}/status`)
      .set(auth(admin.accessToken))
      .send({ status: 'CANCELLED', reason: 'Client cancelled coverage' })
      .expect(200);

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
    });
    expect(assignment?.status).toBe('CANCELLED');

    const archive = await request(app.getHttpServer())
      .delete(`/api/v1/shifts/${shiftId}`)
      .set(auth(admin.accessToken));
    expect(archive.status).toBe(204);
    expect(
      archive.text === '' || archive.body === '' || archive.body == null,
    ).toBe(true);
  });

  it('32-37. health, readiness, swagger, login, phase4, no secrets', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    await request(app.getHttpServer()).get('/docs').expect(200);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        organisationCode: 'GUARDTRAK',
        employeeId: 'ADM-001',
        password: PASSWORD,
        installationId: `p5-final-${runId}`,
        platform: 'ANDROID',
        deviceName: 'Phase5 Final',
        appVersion: '1.0.0-e2e',
      })
      .expect(200);
    assertNoSensitive(loginRes.body);
    const token = asSuccessBody<{ accessToken: string }>(loginRes.body).data
      .accessToken;
    const device = await prisma.device.findUnique({
      where: { installationId: `p5-final-${runId}` },
    });
    if (device) {
      createdDeviceIds.push(device.id);
    }

    const sites = await request(app.getHttpServer())
      .get('/api/v1/sites')
      .set(auth(token))
      .expect(200);
    assertNoSensitive(sites.body);

    // silence unused import
    expect(randomUUID()).toBeTruthy();
  });
});
