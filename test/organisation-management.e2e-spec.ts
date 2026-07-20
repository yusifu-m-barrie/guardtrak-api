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
import type { PaginationMeta } from '../src/common/types/api-response.type';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { asErrorBody, asSuccessBody } from './http-body';

const PASSWORD = 'GuardTrak!Dev2026';
const TEMP_PASSWORD = 'Strong!Temporary2026';
const OFFICER1_PROFILE_ID = '77777777-7777-4777-8777-777777777777';
const OFFICER2_PROFILE_ID = '88888888-8888-4888-8888-888888888888';
const SUPERVISOR_PROFILE_ID = '99999999-9999-4999-8999-999999999999';
const FAKE_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('Organisation management Phase 4 (e2e)', () => {
  jest.setTimeout(120_000);
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const runId = Date.now();
  const createdUserIds: string[] = [];
  const createdOfficerProfileIds: string[] = [];
  const createdSupervisorProfileIds: string[] = [];
  const createdClientIds: string[] = [];
  const createdSiteIds: string[] = [];
  const createdDeviceIds: string[] = [];
  const createdRelationIds: string[] = [];
  let originalOrgName: string | null = null;

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
        transformOptions: {
          enableImplicitConversion: true,
        },
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
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);

    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (originalOrgName) {
      await prisma.organisation.updateMany({
        where: { code: 'GUARDTRAK' },
        data: { name: originalOrgName },
      });
    }

    if (createdRelationIds.length) {
      await prisma.supervisorOfficer.deleteMany({
        where: { id: { in: createdRelationIds } },
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
    if (createdSiteIds.length) {
      await prisma.securitySite.deleteMany({
        where: { id: { in: createdSiteIds } },
      });
    }
    if (createdClientIds.length) {
      await prisma.client.deleteMany({
        where: { id: { in: createdClientIds } },
      });
    }
    if (createdOfficerProfileIds.length) {
      await prisma.supervisorOfficer.deleteMany({
        where: { officerId: { in: createdOfficerProfileIds } },
      });
      await prisma.officerProfile.deleteMany({
        where: { id: { in: createdOfficerProfileIds } },
      });
    }
    if (createdSupervisorProfileIds.length) {
      await prisma.supervisorOfficer.deleteMany({
        where: { supervisorId: { in: createdSupervisorProfileIds } },
      });
      await prisma.supervisorProfile.deleteMany({
        where: { id: { in: createdSupervisorProfileIds } },
      });
    }
    if (createdUserIds.length) {
      await prisma.refreshSession.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.passwordResetToken.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.device.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }

    await app.close();
  });

  async function login(
    employeeId: string,
    installationId = `p4-${runId}-${employeeId}`,
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        organisationCode: 'GUARDTRAK',
        employeeId,
        password: PASSWORD,
        installationId,
        platform: 'ANDROID',
        deviceName: 'Phase4 E2E',
        appVersion: '1.0.0-e2e',
      })
      .expect(200);

    const device = await prisma.device.findUnique({
      where: { installationId },
    });
    if (device) {
      createdDeviceIds.push(device.id);
    }

    const loginBody = asSuccessBody<{
      accessToken: string;
      refreshToken: string;
      user: { id: string };
    }>(res.body);

    return {
      accessToken: loginBody.data.accessToken,
      refreshToken: loginBody.data.refreshToken,
      userId: loginBody.data.user.id,
      deviceId: device?.id,
      installationId,
    };
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  function assertNoSensitive(body: unknown) {
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('tokenHash');
    expect(raw).not.toContain(TEMP_PASSWORD);
    expect(raw).not.toContain(PASSWORD);
  }

  it('1. unauthenticated organisation request returns 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/organisation').expect(401);
  });

  it('2. officer can read own organisation', async () => {
    const { accessToken } = await login('OFF-001', `p4-org-read-${runId}`);
    const res = await request(app.getHttpServer())
      .get('/api/v1/organisation')
      .set(auth(accessToken))
      .expect(200);
    const orgBody = asSuccessBody<{ code: string; deletedAt?: unknown }>(
      res.body,
    );
    expect(orgBody.data.code).toBe('GUARDTRAK');
    expect(orgBody.data.deletedAt).toBeUndefined();
    assertNoSensitive(orgBody);
  });

  it('3. officer cannot update organisation', async () => {
    const { accessToken } = await login('OFF-001', `p4-org-upd-off-${runId}`);
    await request(app.getHttpServer())
      .patch('/api/v1/organisation')
      .set(auth(accessToken))
      .send({ name: 'Should Fail' })
      .expect(403);
  });

  it('4. administrator can update organisation', async () => {
    const { accessToken } = await login('ADM-001', `p4-org-upd-adm-${runId}`);
    const current = await request(app.getHttpServer())
      .get('/api/v1/organisation')
      .set(auth(accessToken))
      .expect(200);
    originalOrgName = asSuccessBody<{ name: string }>(current.body).data.name;

    const res = await request(app.getHttpServer())
      .patch('/api/v1/organisation')
      .set(auth(accessToken))
      .send({ name: `${originalOrgName} E2E` })
      .expect(200);
    expect(asSuccessBody<{ name: string }>(res.body).data.name).toBe(
      `${originalOrgName} E2E`,
    );

    await request(app.getHttpServer())
      .patch('/api/v1/organisation')
      .set(auth(accessToken))
      .send({ name: originalOrgName })
      .expect(200);
  });

  it('5-7. administrator creates and lists users; duplicate employeeId 409', async () => {
    const { accessToken } = await login('ADM-001', `p4-user-create-${runId}`);
    const employeeId = `E2E-U-${runId}`;
    const create = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth(accessToken))
      .send({
        employeeId,
        email: `e2e.user.${runId}@example.com`,
        phone: `+23276${String(runId).slice(-6)}`,
        firstName: 'E2E',
        lastName: 'User',
        role: 'SECURITY_OFFICER',
        temporaryPassword: TEMP_PASSWORD,
        mustChangePassword: true,
      })
      .expect(201);
    const createBody = asSuccessBody<{ id: string; employeeId: string }>(
      create.body,
    );
    createdUserIds.push(createBody.data.id);
    expect(createBody.data.employeeId).toBe(employeeId);
    assertNoSensitive(createBody);

    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth(accessToken))
      .send({
        employeeId,
        email: `e2e.user.dup.${runId}@example.com`,
        firstName: 'Dup',
        lastName: 'User',
        role: 'SECURITY_OFFICER',
        temporaryPassword: TEMP_PASSWORD,
      })
      .expect(409);

    const list = await request(app.getHttpServer())
      .get('/api/v1/users')
      .query({ search: employeeId })
      .set(auth(accessToken))
      .expect(200);
    const listMeta = asSuccessBody<unknown[]>(list.body)
      .meta as unknown as PaginationMeta;
    expect(listMeta.total).toBeGreaterThanOrEqual(1);
    expect(listMeta.page).toBe(1);
    assertNoSensitive(list.body);
  });

  it('8. officer cannot list users', async () => {
    const { accessToken } = await login('OFF-001', `p4-user-list-off-${runId}`);
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set(auth(accessToken))
      .expect(403);
  });

  it('9-11. administrator reads and updates user; unknown id is 404', async () => {
    const { accessToken } = await login('ADM-001', `p4-user-read-${runId}`);
    const targetId = createdUserIds[0];
    expect(targetId).toBeDefined();

    const one = await request(app.getHttpServer())
      .get(`/api/v1/users/${targetId}`)
      .set(auth(accessToken))
      .expect(200);
    expect(asSuccessBody<{ id: string }>(one.body).data.id).toBe(targetId);

    await request(app.getHttpServer())
      .get(`/api/v1/users/${FAKE_UUID}`)
      .set(auth(accessToken))
      .expect(404);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/users/${targetId}`)
      .set(auth(accessToken))
      .send({ displayName: 'E2E Updated' })
      .expect(200);
    expect(
      asSuccessBody<{ displayName: string }>(updated.body).data.displayName,
    ).toBe('E2E Updated');
  });

  it('12-14. suspend stops session; unlock clears lockout path', async () => {
    const { accessToken: adminToken } = await login(
      'ADM-001',
      `p4-suspend-adm-${runId}`,
    );
    const employeeId = `E2E-S-${runId}`;
    const created = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth(adminToken))
      .send({
        employeeId,
        email: `e2e.suspend.${runId}@example.com`,
        firstName: 'Suspend',
        lastName: 'Me',
        role: 'SECURITY_OFFICER',
        temporaryPassword: TEMP_PASSWORD,
      })
      .expect(201);
    const createdUserId = asSuccessBody<{ id: string }>(created.body).data.id;
    createdUserIds.push(createdUserId);

    await prisma.user.update({
      where: { id: createdUserId },
      data: { mustChangePassword: false },
    });

    const userLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        organisationCode: 'GUARDTRAK',
        employeeId,
        password: TEMP_PASSWORD,
        installationId: `p4-suspend-user-${runId}`,
        platform: 'ANDROID',
      })
      .expect(200);
    const userToken = asSuccessBody<{ accessToken: string }>(userLogin.body)
      .data.accessToken;
    const suspendDevice = await prisma.device.findUnique({
      where: { installationId: `p4-suspend-user-${runId}` },
    });
    if (suspendDevice) {
      createdDeviceIds.push(suspendDevice.id);
    }

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${createdUserId}/status`)
      .set(auth(adminToken))
      .send({ status: 'SUSPENDED', reason: 'E2E suspension' })
      .expect(200);

    const blocked = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(auth(userToken));
    expect([401, 403]).toContain(blocked.status);

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${createdUserId}/status`)
      .set(auth(adminToken))
      .send({ status: 'ACTIVE', reason: 'E2E restore' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/users/${createdUserId}/unlock`)
      .set(auth(adminToken))
      .expect(200);
  });

  it('15. administrator cannot create SUPER_ADMIN', async () => {
    const { accessToken } = await login('ADM-001', `p4-super-${runId}`);
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth(accessToken))
      .send({
        employeeId: `E2E-SA-${runId}`,
        email: `e2e.sa.${runId}@example.com`,
        firstName: 'Nope',
        lastName: 'Super',
        role: 'SUPER_ADMIN',
        temporaryPassword: TEMP_PASSWORD,
      })
      .expect(403);
  });

  it('16. last active administrator cannot be disabled', async () => {
    const { accessToken: adminToken } = await login(
      'ADM-001',
      `p4-last-admin-${runId}`,
    );

    const peer = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth(adminToken))
      .send({
        employeeId: `E2E-AD-${runId}`,
        email: `e2e.admin.${runId}@example.com`,
        firstName: 'Peer',
        lastName: 'Admin',
        role: 'ADMINISTRATOR',
        temporaryPassword: TEMP_PASSWORD,
      })
      .expect(201);
    const peerUserId = asSuccessBody<{ id: string }>(peer.body).data.id;
    createdUserIds.push(peerUserId);

    await prisma.user.update({
      where: { id: peerUserId },
      data: { mustChangePassword: false, status: 'INVITED' },
    });

    const peerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        organisationCode: 'GUARDTRAK',
        employeeId: `E2E-AD-${runId}`,
        password: TEMP_PASSWORD,
        installationId: `p4-last-admin-peer-${runId}`,
        platform: 'ANDROID',
      })
      .expect(200);
    const peerDevice = await prisma.device.findUnique({
      where: { installationId: `p4-last-admin-peer-${runId}` },
    });
    if (peerDevice) {
      createdDeviceIds.push(peerDevice.id);
    }

    const seedAdmin = await prisma.user.findFirst({
      where: { employeeId: 'ADM-001', deletedAt: null },
    });
    expect(seedAdmin).toBeTruthy();

    try {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/users/${seedAdmin!.id}/status`)
        .set(
          auth(
            asSuccessBody<{ accessToken: string }>(peerLogin.body).data
              .accessToken,
          ),
        )
        .send({ status: 'DISABLED', reason: 'should fail — last active admin' })
        .expect(409);
      expect(asErrorBody(res.body).code).toBe('USER_LAST_ADMIN_REQUIRED');
    } finally {
      await prisma.user.update({
        where: { id: seedAdmin!.id },
        data: { status: 'ACTIVE' },
      });
      await prisma.user.update({
        where: { id: peerUserId },
        data: { status: 'ACTIVE' },
      });
    }
  });

  it('17-20. officer create, duplicate number, me, and access rules', async () => {
    const { accessToken: adminToken } = await login(
      'ADM-001',
      `p4-off-adm-${runId}`,
    );
    const create = await request(app.getHttpServer())
      .post('/api/v1/officers')
      .set(auth(adminToken))
      .send({
        user: {
          employeeId: `E2E-O-${runId}`,
          email: `e2e.officer.${runId}@example.com`,
          phone: `+23277${String(runId).slice(-6)}`,
          firstName: 'E2E',
          lastName: 'Officer',
          temporaryPassword: TEMP_PASSWORD,
        },
        profile: {
          officerNumber: `GT-E2E-${runId}`,
          employmentStatus: 'ACTIVE',
          hireDate: '2026-07-18',
          rankOrTitle: 'Security Officer',
        },
      })
      .expect(201);
    const createBody = asSuccessBody<{
      profile: { id: string };
      user: { id: string };
    }>(create.body);
    createdOfficerProfileIds.push(createBody.data.profile.id);
    createdUserIds.push(createBody.data.user.id);
    assertNoSensitive(createBody);

    await request(app.getHttpServer())
      .post('/api/v1/officers')
      .set(auth(adminToken))
      .send({
        user: {
          employeeId: `E2E-O2-${runId}`,
          email: `e2e.officer2.${runId}@example.com`,
          firstName: 'Dup',
          lastName: 'Officer',
          temporaryPassword: TEMP_PASSWORD,
        },
        profile: {
          officerNumber: `GT-E2E-${runId}`,
        },
      })
      .expect(409);

    await prisma.user.update({
      where: { id: createBody.data.user.id },
      data: { mustChangePassword: false },
    });

    const officerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        organisationCode: 'GUARDTRAK',
        employeeId: `E2E-O-${runId}`,
        password: TEMP_PASSWORD,
        installationId: `p4-off-me-${runId}`,
        platform: 'ANDROID',
      })
      .expect(200);
    const officerToken = asSuccessBody<{ accessToken: string }>(
      officerLogin.body,
    ).data.accessToken;
    const meDevice = await prisma.device.findUnique({
      where: { installationId: `p4-off-me-${runId}` },
    });
    if (meDevice) {
      createdDeviceIds.push(meDevice.id);
    }

    const me = await request(app.getHttpServer())
      .get('/api/v1/officers/me')
      .set(auth(officerToken))
      .expect(200);
    expect(
      asSuccessBody<{ profile: { officerNumber: string } }>(me.body).data
        .profile.officerNumber,
    ).toBe(`GT-E2E-${runId}`);
    assertNoSensitive(me.body);

    await request(app.getHttpServer())
      .get(`/api/v1/officers/${OFFICER1_PROFILE_ID}`)
      .set(auth(officerToken))
      .expect(404);
  });

  it('21-24. supervisor assigned/unassigned visibility and assignment', async () => {
    const { accessToken: supervisorToken } = await login(
      'SUP-001',
      `p4-sup-${runId}`,
    );

    await request(app.getHttpServer())
      .get(`/api/v1/officers/${OFFICER1_PROFILE_ID}`)
      .set(auth(supervisorToken))
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/officers/${OFFICER2_PROFILE_ID}`)
      .set(auth(supervisorToken))
      .expect(404);

    const { accessToken: adminToken } = await login(
      'ADM-001',
      `p4-assign-adm-${runId}`,
    );

    const assign = await request(app.getHttpServer())
      .post(`/api/v1/supervisors/${SUPERVISOR_PROFILE_ID}/officers`)
      .set(auth(adminToken))
      .send({
        officerIds: [OFFICER2_PROFILE_ID],
        activeFrom: '2026-07-18T00:00:00.000Z',
      })
      .expect(201);

    const relations = await prisma.supervisorOfficer.findMany({
      where: {
        supervisorId: SUPERVISOR_PROFILE_ID,
        officerId: OFFICER2_PROFILE_ID,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (relations[0]) {
      createdRelationIds.push(relations[0].id);
    }
    expect(assign.body).toBeDefined();

    await request(app.getHttpServer())
      .post(`/api/v1/supervisors/${SUPERVISOR_PROFILE_ID}/officers`)
      .set(auth(adminToken))
      .send({
        officerIds: [OFFICER2_PROFILE_ID],
        activeFrom: '2026-07-18T00:00:00.000Z',
      })
      .expect(409);

    await request(app.getHttpServer())
      .get(`/api/v1/officers/${OFFICER2_PROFILE_ID}`)
      .set(auth(supervisorToken))
      .expect(200);

    await request(app.getHttpServer())
      .delete(
        `/api/v1/supervisors/${SUPERVISOR_PROFILE_ID}/officers/${OFFICER2_PROFILE_ID}`,
      )
      .set(auth(adminToken))
      .expect(204);
  });

  it('25-30. clients, sites, validation and archive rules', async () => {
    const { accessToken } = await login('ADM-001', `p4-client-${runId}`);

    const client = await request(app.getHttpServer())
      .post('/api/v1/clients')
      .set(auth(accessToken))
      .send({
        name: `E2E Holdings ${runId}`,
        legalName: `E2E Holdings Limited ${runId}`,
        registrationNumber: `E2E-REG-${runId}`,
        primaryContactName: 'Contact Person',
        primaryContactEmail: `client.${runId}@example.com`,
        primaryContactPhone: `+23279${String(runId).slice(-6)}`,
      })
      .expect(201);
    const clientId = asSuccessBody<{ id: string }>(client.body).data.id;
    createdClientIds.push(clientId);

    const list = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .query({ page: 1, limit: 5, search: `E2E Holdings ${runId}` })
      .set(auth(accessToken))
      .expect(200);
    const listMeta = asSuccessBody<unknown[]>(list.body)
      .meta as unknown as PaginationMeta;
    expect(listMeta.limit).toBe(5);
    expect(
      asSuccessBody<unknown[]>(list.body).data.length,
    ).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .post('/api/v1/sites')
      .set(auth(accessToken))
      .send({
        clientId,
        name: 'Bad Coords',
        code: `BAD-${runId}`,
        address: 'Invalid',
        latitude: 120,
        longitude: -12,
        clockInRadiusMeters: 150,
        clockOutRadiusMeters: 150,
      })
      .expect(400);

    const site = await request(app.getHttpServer())
      .post('/api/v1/sites')
      .set(auth(accessToken))
      .send({
        clientId,
        name: `E2E Site ${runId}`,
        code: `E2E-${runId}`,
        address: 'Makeni, Sierra Leone',
        latitude: 8.8833,
        longitude: -12.05,
        clockInRadiusMeters: 150,
        clockOutRadiusMeters: 150,
        checkpointDefaultRadiusMeters: 50,
        minimumGpsAccuracyMeters: 50,
        clockInOutsideGeofencePolicy: 'ALLOW_WITH_REASON',
        clockOutOutsideGeofencePolicy: 'ALLOW_WITH_REASON',
        requiresClockInSelfie: false,
        requiresClockOutSelfie: false,
        requiresPatrol: true,
        requiresFinalShiftNote: true,
      })
      .expect(201);
    const siteId = asSuccessBody<{ id: string }>(site.body).data.id;
    createdSiteIds.push(siteId);

    await request(app.getHttpServer())
      .post('/api/v1/sites')
      .set(auth(accessToken))
      .send({
        clientId,
        name: 'Dup Code',
        code: `E2E-${runId}`,
        address: 'Somewhere',
        latitude: 8.88,
        longitude: -12.05,
        clockInRadiusMeters: 100,
        clockOutRadiusMeters: 100,
      })
      .expect(409);

    await request(app.getHttpServer())
      .delete(`/api/v1/clients/${clientId}`)
      .set(auth(accessToken))
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/api/v1/sites/${siteId}/status`)
      .set(auth(accessToken))
      .send({ status: 'INACTIVE' })
      .expect(200);

    const archive = await request(app.getHttpServer())
      .delete(`/api/v1/clients/${clientId}`)
      .set(auth(accessToken))
      .expect(204);
    expect(archive.body).toEqual({});
  });

  it('31-34. devices list, revoke sessions, blocked device auth', async () => {
    const officerLogin = await login('OFF-001', `p4-dev-off-${runId}`);

    const meDevices = await request(app.getHttpServer())
      .get('/api/v1/devices/me')
      .set(auth(officerLogin.accessToken))
      .expect(200);
    expect(Array.isArray(asSuccessBody<unknown[]>(meDevices.body).data)).toBe(
      true,
    );
    assertNoSensitive(meDevices.body);
    expect(JSON.stringify(meDevices.body)).not.toContain('pushToken');

    const { accessToken: adminToken } = await login(
      'ADM-001',
      `p4-dev-adm-${runId}`,
    );
    const all = await request(app.getHttpServer())
      .get('/api/v1/devices')
      .query({ userId: officerLogin.userId })
      .set(auth(adminToken))
      .expect(200);
    expect(
      asSuccessBody<unknown[]>(all.body).meta as unknown as PaginationMeta,
    ).toBeDefined();

    const deviceId = officerLogin.deviceId;
    expect(deviceId).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/api/v1/devices/${deviceId}/status`)
      .set(auth(adminToken))
      .send({ status: 'REVOKED', reason: 'E2E revoke' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: officerLogin.refreshToken })
      .expect(401);

    const blockLogin = await login('OFF-002', `p4-dev-block-${runId}`);

    await request(app.getHttpServer())
      .patch(`/api/v1/devices/${blockLogin.deviceId}/status`)
      .set(auth(adminToken))
      .send({ status: 'BLOCKED', reason: 'E2E block' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        organisationCode: 'GUARDTRAK',
        employeeId: 'OFF-002',
        password: PASSWORD,
        installationId: `p4-dev-block-${runId}`,
        platform: 'ANDROID',
      })
      .expect(403);
  });

  it('35. archive endpoints return 204 without body', async () => {
    const { accessToken } = await login('ADM-001', `p4-archive-${runId}`);
    const created = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth(accessToken))
      .send({
        employeeId: `E2E-A-${runId}`,
        email: `e2e.archive.${runId}@example.com`,
        firstName: 'Archive',
        lastName: 'Me',
        role: 'SECURITY_OFFICER',
        temporaryPassword: TEMP_PASSWORD,
      })
      .expect(201);
    const archivedUserId = asSuccessBody<{ id: string }>(created.body).data.id;
    createdUserIds.push(archivedUserId);

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/users/${archivedUserId}`)
      .set(auth(accessToken))
      .expect(204);
    expect(res.body).toEqual({});
  });

  it('36-38. health, readiness and swagger remain public', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    await request(app.getHttpServer()).get('/docs').expect(200);
  });

  it('39-40. existing login works; sensitive fields never appear', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        organisationCode: 'GUARDTRAK',
        employeeId: 'ADM-001',
        password: PASSWORD,
        installationId: `p4-final-login-${runId}`,
        platform: 'ANDROID',
      })
      .expect(200);
    const device = await prisma.device.findUnique({
      where: { installationId: `p4-final-login-${runId}` },
    });
    if (device) {
      createdDeviceIds.push(device.id);
    }
    assertNoSensitive(res.body);
  });
});
