import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from '../database/prisma/prisma.service';
import { RedisService } from '../infrastructure/redis/redis.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { isHealthy: jest.Mock };

  const createModule = async (healthy: boolean) => {
    prisma = {
      isHealthy: jest.fn().mockResolvedValue(healthy),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RedisService,
          useValue: {
            healthCheck: jest.fn().mockResolvedValue({ status: 'memory' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'app.nodeEnv') {
                return 'test';
              }
              return undefined;
            },
          },
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  };

  it('live returns ok without database checks', async () => {
    await createModule(true);
    const result = controller.live();
    expect(result.status).toBe('ok');
    expect(prisma.isHealthy).not.toHaveBeenCalled();
  });

  it('returns ok when database is healthy', async () => {
    await createModule(true);
    const res = {
      status: jest.fn(),
    };

    const result = await controller.check(res as never);

    expect(result.status).toBe('ok');
    expect(result.application).toBe('guardtrak-api');
    expect(result.database.status).toBe('up');
    expect(result.redis.status).toBe('memory');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns unhealthy and 503 when database is down', async () => {
    await createModule(false);
    const res = {
      status: jest.fn(),
    };

    const result = await controller.check(res as never);

    expect(result.status).toBe('unhealthy');
    expect(result.database.status).toBe('down');
    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('readiness returns not_ready when database is down', async () => {
    await createModule(false);
    const res = {
      status: jest.fn(),
    };

    const result = await controller.ready(res as never);

    expect(result.status).toBe('not_ready');
    expect(result.redis.status).toBe('memory');
    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });
});
