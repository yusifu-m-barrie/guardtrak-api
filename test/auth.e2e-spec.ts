import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NextFunction } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';
import { asErrorBody, asSuccessBody } from './http-body';

/**
 * Auth E2E against the local development database and seed accounts.
 * Mutates lockout/password state carefully and restores seed password where needed.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const password = 'GuardTrak!Dev2026';
  const installationId = `e2e-install-${Date.now()}`;

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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps health public', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });

  it('rejects missing token on /auth/me', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);
    expect(asErrorBody(res.body).success).toBe(false);
  });

  it('logs in officer and returns tokens without sensitive fields', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        organisationCode: 'GUARDTRAK',
        employeeId: 'OFF-001',
        password,
        installationId,
        platform: 'ANDROID',
        deviceName: 'E2E Device',
        appVersion: '1.0.0-e2e',
      })
      .expect(200);

    const body = asSuccessBody<{
      accessToken: string;
      refreshToken: string;
      user: { employeeId: string };
      permissions: unknown[];
    }>(res.body);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeDefined();
    expect(body.data.user.employeeId).toBe('OFF-001');
    expect(body.data.permissions.length).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain('passwordHash');
    expect(JSON.stringify(body)).not.toContain('tokenHash');
  });

  it('accesses /auth/me with bearer token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        organisationCode: 'GUARDTRAK',
        employeeId: 'OFF-001',
        password,
        installationId: `${installationId}-me`,
        platform: 'ANDROID',
      })
      .expect(200);

    const loginBody = asSuccessBody<{ accessToken: string }>(login.body);
    const token = loginBody.data.accessToken;
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const meBody = asSuccessBody<{
      user: { employeeId: string };
      officer: unknown;
    }>(me.body);
    expect(meBody.data.user.employeeId).toBe('OFF-001');
    expect(meBody.data.officer).toBeTruthy();
  });

  it('rotates refresh tokens and rejects reuse', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        organisationCode: 'GUARDTRAK',
        employeeId: 'OFF-002',
        password,
        installationId: `${installationId}-refresh`,
        platform: 'ANDROID',
      })
      .expect(200);

    const loginBody = asSuccessBody<{ refreshToken: string }>(login.body);
    const oldRefresh = loginBody.data.refreshToken;
    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(200);

    const refreshedBody = asSuccessBody<{ refreshToken: string }>(
      refreshed.body,
    );
    expect(refreshedBody.data.refreshToken).toBeDefined();
    expect(refreshedBody.data.refreshToken).not.toBe(oldRefresh);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(401);
  });

  it('rejects invalid credentials without enumeration detail', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        organisationCode: 'GUARDTRAK',
        employeeId: 'OFF-001',
        password: 'WrongPassword1!',
        installationId: `${installationId}-bad`,
        platform: 'ANDROID',
      })
      .expect(401);

    expect(asErrorBody(res.body).code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('forgot-password returns generic message and optional dev OTP', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({
        organisationCode: 'GUARDTRAK',
        employeeId: 'OFF-001',
      })
      .expect(200);

    expect(asSuccessBody<{ message: string }>(res.body).data.message).toContain(
      'If the account exists',
    );
  });

  it('rejects unknown DTO fields on login', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        organisationCode: 'GUARDTRAK',
        employeeId: 'OFF-001',
        password,
        installationId: `${installationId}-extra`,
        platform: 'ANDROID',
        unexpected: true,
      })
      .expect(400);
  });
});
