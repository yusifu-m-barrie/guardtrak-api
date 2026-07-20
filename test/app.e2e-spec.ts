import { Test, TestingModule } from '@nestjs/testing';
import {
  Body,
  Controller,
  Get,
  Global,
  INestApplication,
  Module,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { IsString } from 'class-validator';
import { HealthModule } from '../src/health/health.module';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';

class EchoDto {
  @IsString()
  name!: string;
}

@Controller('validation-check')
class ValidationCheckController {
  @Post()
  echo(@Body() body: EchoDto): EchoDto {
    return body;
  }

  @Get()
  ping(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  controllers: [ValidationCheckController],
})
class ValidationCheckModule {}

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useValue: {
        isHealthy: jest.fn().mockResolvedValue(true),
      },
    },
  ],
  exports: [PrismaService],
})
class MockPrismaModule {}

describe('Health and envelope (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              app: { nodeEnv: 'test' },
            }),
          ],
        }),
        MockPrismaModule,
        HealthModule,
        ValidationCheckModule,
      ],
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
        req: { requestId?: string; headers: Record<string, unknown> },
        res: { setHeader: (k: string, v: string) => void },
        next: () => void,
      ) => {
        const middleware = new RequestIdMiddleware();
        middleware.use(req as never, res as never, next);
      },
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns enveloped success', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: { application: string };
      requestId: string;
    };

    expect(body.success).toBe(true);
    expect(body.data.application).toBe('guardtrak-api');
    expect(body.requestId).toBeDefined();
  });

  it('rejects unknown DTO fields with error envelope', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/validation-check')
      .send({ name: 'ok', unexpected: true })
      .expect(400);

    const body = response.body as {
      success: boolean;
      code: string;
      requestId: string;
      path: string;
    };

    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.requestId).toBeDefined();
    expect(body.path).toContain('/api/v1/validation-check');
  });
});
