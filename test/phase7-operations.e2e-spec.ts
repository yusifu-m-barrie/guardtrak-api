import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction } from 'express';
import { createHash } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { asErrorBody, asSuccessBody } from './http-body';

const PASSWORD = 'GuardTrak!Dev2026';
const SITE_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('Phase 7 Operations (e2e)', () => {
  jest.setTimeout(120_000);
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const runId = Date.now();
  const createdIncidentIds: string[] = [];
  const createdEvidenceIds: string[] = [];
  const createdEmergencyIds: string[] = [];
  const createdSupportIds: string[] = [];
  const createdDeviceIds: string[] = [];
  const createdNotificationIds: string[] = [];
  const createdSyncOpIds: string[] = [];
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

    if (createdEvidenceIds.length) {
      await prisma.evidence.deleteMany({
        where: { id: { in: createdEvidenceIds } },
      });
    }
    if (createdIncidentIds.length) {
      await prisma.incidentNote.deleteMany({
        where: { incidentId: { in: createdIncidentIds } },
      });
      await prisma.incidentStatusEvent.deleteMany({
        where: { incidentId: { in: createdIncidentIds } },
      });
      await prisma.incident.deleteMany({
        where: { id: { in: createdIncidentIds } },
      });
    }
    if (createdEmergencyIds.length) {
      await prisma.emergencyStatusEvent.deleteMany({
        where: { emergencyId: { in: createdEmergencyIds } },
      });
      await prisma.notification
        .deleteMany({
          where: {
            data: { path: ['emergencyId'], string_contains: '' },
          },
        })
        .catch(() => undefined);
      await prisma.emergency.deleteMany({
        where: { id: { in: createdEmergencyIds } },
      });
    }
    if (createdSupportIds.length) {
      await prisma.supportMessage.deleteMany({
        where: { supportRequestId: { in: createdSupportIds } },
      });
      await prisma.supportRequest.deleteMany({
        where: { id: { in: createdSupportIds } },
      });
    }
    if (createdNotificationIds.length) {
      await prisma.notificationDelivery.deleteMany({
        where: { notificationId: { in: createdNotificationIds } },
      });
      await prisma.notification.deleteMany({
        where: { id: { in: createdNotificationIds } },
      });
    }
    if (createdSyncOpIds.length) {
      await prisma.syncOperation.deleteMany({
        where: { operationId: { in: createdSyncOpIds } },
      });
      await prisma.syncConflict.deleteMany({
        where: { operationId: { in: createdSyncOpIds } },
      });
      await prisma.idempotencyRecord.deleteMany({
        where: {
          key: { in: createdSyncOpIds.map((id) => `sync:${id}`) },
        },
      });
    }
    if (createdDeviceIds.length) {
      await prisma.pushToken.deleteMany({
        where: { deviceId: { in: createdDeviceIds } },
      });
      await prisma.refreshSession.deleteMany({
        where: { deviceId: { in: createdDeviceIds } },
      });
      await prisma.device.deleteMany({
        where: { id: { in: createdDeviceIds } },
      });
    }

    await app.close();
  });

  async function login(employeeId: string) {
    const installationId = `p7-${runId}-${employeeId}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        organisationCode: 'GUARDTRAK',
        employeeId,
        password: PASSWORD,
        installationId,
        platform: 'ANDROID',
        deviceName: 'Phase7 E2E',
        appVersion: '1.0.0-e2e',
      });
    expect(res.status).toBe(200);
    const body = asSuccessBody<{
      accessToken: string;
      user: { id: string };
    }>(res.body);
    const device = await prisma.device.findUnique({
      where: { installationId },
    });
    if (device) {
      createdDeviceIds.push(device.id);
    }
    return body.data;
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it('1. 401 unauthenticated incident create', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .send({
        siteId: SITE_A,
        category: 'OTHER',
        severity: 'LOW',
        title: 'x',
        description: 'y',
        occurredAtDevice: new Date().toISOString(),
        idempotencyKey: `unauth-${runId}`,
      });
    expect(res.status).toBe(401);
    expect(asErrorBody(res.body).success).toBe(false);
  });

  it('2. Officer creates incident', async () => {
    const officer = await login('OFF-001');
    const res = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set(auth(officer.accessToken))
      .send({
        siteId: SITE_A,
        category: 'SUSPICIOUS_ACTIVITY',
        severity: 'MEDIUM',
        priority: 'NORMAL',
        title: `E2E incident ${runId}`,
        description: 'Phase 7 e2e incident create',
        occurredAtDevice: new Date().toISOString(),
        latitude: 8.4657,
        longitude: -13.2317,
        idempotencyKey: `inc-create-${runId}`,
      });
    expect([200, 201]).toContain(res.status);
    const body = asSuccessBody<{ id: string; incidentNumber: string }>(
      res.body,
    );
    expect(body.data.id).toBeDefined();
    createdIncidentIds.push(body.data.id);
  });

  it('3. Officer list is self-scoped (not full org)', async () => {
    const officer = await login('OFF-001');
    const res = await request(app.getHttpServer())
      .get('/api/v1/incidents')
      .set(auth(officer.accessToken));
    expect(res.status).toBe(200);
    const body = asSuccessBody<Array<{ reportedByUserId: string }>>(res.body);
    for (const row of body.data) {
      expect(row.reportedByUserId).toBe(officer.user.id);
    }
  });

  it('4. Upload-url + complete evidence (local storage)', async () => {
    const officer = await login('OFF-001');
    const incidentId = createdIncidentIds[0];
    expect(incidentId).toBeDefined();

    const uploadRes = await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/evidence/upload-url`)
      .set(auth(officer.accessToken))
      .send({
        type: 'IMAGE',
        originalFileName: 'e2e.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 5,
      });
    expect([200, 201]).toContain(uploadRes.status);
    const upload = asSuccessBody<{
      evidenceId: string;
      uploadUrl: string;
      storageKey: string;
    }>(uploadRes.body).data;
    createdEvidenceIds.push(upload.evidenceId);
    expect(upload.uploadUrl).not.toContain('SECRET');
    expect(JSON.stringify(upload)).not.toMatch(/STORAGE_SECRET|accessKey/i);

    const ticketId = upload.uploadUrl.replace('local-upload://', '');
    const fileBytes = Buffer.from('hello');
    const checksum = createHash('sha256').update(fileBytes).digest('hex');
    const completeRes = await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/evidence/complete`)
      .set(auth(officer.accessToken))
      .send({
        evidenceId: upload.evidenceId,
        checksum,
        localTicketId: ticketId,
        localFileBase64: fileBytes.toString('base64'),
      });
    expect([200, 201]).toContain(completeRes.status);
    const complete = asSuccessBody<{ status: string; checksum: string }>(
      completeRes.body,
    ).data;
    expect(complete.status).toBe('AVAILABLE');
    expect(complete.checksum).toBe(checksum);
  });

  it('5. No storage secrets in evidence responses', async () => {
    const officer = await login('OFF-001');
    const incidentId = createdIncidentIds[0];
    const res = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${incidentId}/evidence`)
      .set(auth(officer.accessToken));
    expect(res.status).toBe(200);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/STORAGE_SECRET|secretKey|accessKey/i);
  });

  it('6. SOS create notifies supervisors/admins', async () => {
    const officer = await login('OFF-001');
    const res = await request(app.getHttpServer())
      .post('/api/v1/emergency/sos')
      .set(auth(officer.accessToken))
      .send({
        deviceCreatedAt: new Date().toISOString(),
        latitude: 8.4657,
        longitude: -13.2317,
        accuracyMeters: 12,
        siteId: SITE_A,
        idempotencyKey: `sos-${runId}`,
      });
    expect([200, 201]).toContain(res.status);
    const sos = asSuccessBody<{ id: string; status: string }>(res.body).data;
    createdEmergencyIds.push(sos.id);
    expect(sos.status).toBe('ACTIVE');

    const notifications = await prisma.notification.findMany({
      where: {
        type: 'SOS_ALERT',
        createdAt: { gte: new Date(runId - 60_000) },
      },
      take: 20,
    });
    const matching = notifications.filter((n) => {
      const data = n.data as { emergencyId?: string } | null;
      return data?.emergencyId === sos.id;
    });
    expect(matching.length).toBeGreaterThan(0);
    createdNotificationIds.push(...matching.map((n) => n.id));
  });

  it('7. Supervisor acknowledges SOS', async () => {
    const supervisor = await login('SUP-001');
    const emergencyId = createdEmergencyIds[0];
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/emergency/${emergencyId}/status`)
      .set(auth(supervisor.accessToken))
      .send({ status: 'ACKNOWLEDGED', note: 'En route' });
    expect(res.status).toBe(200);
    const body = asSuccessBody<{ status: string }>(res.body).data;
    expect(body.status).toBe('ACKNOWLEDGED');
  });

  it('8. Support ticket create + message', async () => {
    const officer = await login('OFF-001');
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/support/requests')
      .set(auth(officer.accessToken))
      .send({
        subject: `E2E support ${runId}`,
        description: 'Need help with offline sync',
        category: 'TECHNICAL',
      });
    expect([200, 201]).toContain(createRes.status);
    const ticket = asSuccessBody<{ id: string }>(createRes.body).data;
    createdSupportIds.push(ticket.id);

    const msgRes = await request(app.getHttpServer())
      .post(`/api/v1/support/requests/${ticket.id}/messages`)
      .set(auth(officer.accessToken))
      .send({ body: 'Additional detail for e2e' });
    expect([200, 201]).toContain(msgRes.status);
  });

  it('9. FAQ public and auth list', async () => {
    const publicRes = await request(app.getHttpServer()).get(
      '/api/v1/help/faq',
    );
    expect(publicRes.status).toBe(200);
    const publicBody = asSuccessBody<Array<{ question: string }>>(
      publicRes.body,
    );
    expect(publicBody.data.length).toBeGreaterThan(0);

    const officer = await login('OFF-001');
    const authRes = await request(app.getHttpServer())
      .get('/api/v1/help/faq/org')
      .set(auth(officer.accessToken));
    expect(authRes.status).toBe(200);
  });

  it('10. Reports dashboard 200 for admin', async () => {
    const admin = await login('ADM-001');
    const res = await request(app.getHttpServer())
      .get('/api/v1/reports/dashboard')
      .set(auth(admin.accessToken));
    expect(res.status).toBe(200);
    const body = asSuccessBody<{ openIncidents: number }>(res.body).data;
    expect(typeof body.openIncidents).toBe('number');
  });

  it('11. Sync batch idempotent replay', async () => {
    const officer = await login('OFF-001');
    const operationId = `sync-inc-${runId}`;
    createdSyncOpIds.push(operationId);
    const payload = {
      operations: [
        {
          operationId,
          operationType: 'create',
          entityType: 'incident.create',
          clientTimestamp: new Date().toISOString(),
          localEntityId: `local-inc-${runId}`,
          payload: {
            siteId: SITE_A,
            category: 'OTHER',
            severity: 'LOW',
            title: `Sync incident ${runId}`,
            description: 'Created via sync batch',
            occurredAtDevice: new Date().toISOString(),
          },
        },
      ],
    };
    const first = await request(app.getHttpServer())
      .post('/api/v1/sync/batch')
      .set(auth(officer.accessToken))
      .send(payload);
    expect([200, 201]).toContain(first.status);
    const firstBody = asSuccessBody<{
      results: Array<{
        operationId: string;
        status: string;
        resourceId?: string;
      }>;
    }>(first.body).data;
    expect(firstBody.results[0]?.status).toBe('completed');
    if (firstBody.results[0]?.resourceId) {
      createdIncidentIds.push(firstBody.results[0].resourceId);
    }

    const second = await request(app.getHttpServer())
      .post('/api/v1/sync/batch')
      .set(auth(officer.accessToken))
      .send(payload);
    expect([200, 201]).toContain(second.status);
    const secondBody = asSuccessBody<{
      results: Array<{ status: string }>;
    }>(second.body).data;
    expect(['replayed', 'completed']).toContain(secondBody.results[0]?.status);
  });

  it('12. Health / ready / swagger still work', async () => {
    const health = await request(app.getHttpServer()).get('/api/v1/health');
    expect(health.status).toBe(200);
    const ready = await request(app.getHttpServer()).get(
      '/api/v1/health/ready',
    );
    expect([200, 503]).toContain(ready.status);
    const docs = await request(app.getHttpServer()).get('/docs');
    expect(docs.status).toBe(200);
  });

  it('13. Existing auth login works', async () => {
    const admin = await login('ADM-001');
    expect(admin.accessToken).toBeTruthy();
  });
});
