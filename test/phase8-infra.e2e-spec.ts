import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';
import { asSuccessBody } from './http-body';

const PASSWORD = 'FOLPS!Dev2026';

describe('Phase 8 Infrastructure (e2e)', () => {
  jest.setTimeout(120_000);

  let app: INestApplication<App>;
  let metricsEnabled = true;
  let swaggerEnabled = false;

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

    const configService = app.get(ConfigService);
    metricsEnabled =
      configService.get<boolean>('observability.metricsEnabled') ?? true;
    swaggerEnabled = configService.get<boolean>('app.enableSwagger') ?? false;

    if (swaggerEnabled) {
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
    }

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns 200 with application metadata', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    const body = asSuccessBody<{
      status: string;
      application: string;
      database: { status: string };
    }>(res.body);

    expect(body.success).toBe(true);
    expect(body.data.application).toBe('guardtrak-api');
    expect(body.data.status).toBeDefined();
    expect(body.data.database.status).toBeDefined();
  });

  it('GET /api/v1/health/ready returns readiness status', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready');

    expect([200, 503]).toContain(res.status);

    const body = res.body as {
      success?: boolean;
      data?: { status: string; database: { status: string } };
      status?: string;
    };

    if (body.success === true && body.data) {
      expect(body.data.status).toMatch(/ready|not_ready/);
      expect(body.data.database.status).toBeDefined();
    } else if (body.status) {
      expect(body.status).toMatch(/ready|not_ready/);
    }
  });

  it('GET /api/v1/metrics when METRICS_ENABLED', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/metrics');

    if (!metricsEnabled) {
      expect([404, 401, 403]).toContain(res.status);
      return;
    }

    if (res.status === 200) {
      expect(res.text.length).toBeGreaterThan(0);
      return;
    }

    expect([404, 401, 403]).toContain(res.status);
  });

  it('GET /docs when Swagger is enabled in this environment', async () => {
    if (!swaggerEnabled) {
      return;
    }

    await request(app.getHttpServer()).get('/docs').expect(200);
  });

  it('login smoke with seed officer account', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        organisationCode: 'FOLPS',
        employeeId: 'OFF-001',
        password: PASSWORD,
        installationId: `phase8-infra-${Date.now()}`,
        platform: 'ANDROID',
        deviceName: 'Phase 8 Infra E2E',
        appVersion: '1.0.0-e2e',
      })
      .expect(200);

    const body = asSuccessBody<{
      accessToken: string;
      refreshToken: string;
      user: { employeeId: string };
    }>(res.body);

    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeDefined();
    expect(body.data.user.employeeId).toBe('OFF-001');
  });
});
