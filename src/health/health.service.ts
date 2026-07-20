import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma/prisma.service';
import { RedisService } from '../infrastructure/redis/redis.service';
import type {
  HealthCheckResult,
  LivenessCheckResult,
  ReadinessCheckResult,
} from './health.types';

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  live(): LivenessCheckResult {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  async check(): Promise<HealthCheckResult> {
    const databaseUp = await this.prisma.isHealthy();
    const redis = await this.redisService.healthCheck();
    const environment =
      this.configService.get<string>('app.nodeEnv') ?? 'development';

    const redisReady = redis.status === 'up' || redis.status === 'memory';
    const healthy = databaseUp && redisReady;

    return {
      status: healthy ? 'ok' : 'unhealthy',
      application: 'guardtrak-api',
      environment,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      database: {
        status: databaseUp ? 'up' : 'down',
      },
      redis: {
        status: redis.status,
      },
    };
  }

  async readiness(): Promise<ReadinessCheckResult> {
    const databaseUp = await this.prisma.isHealthy();
    const redis = await this.redisService.healthCheck();
    const redisReady = redis.status === 'up' || redis.status === 'memory';

    return {
      status: databaseUp && redisReady ? 'ready' : 'not_ready',
      database: {
        status: databaseUp ? 'up' : 'down',
      },
      redis: {
        status: redis.status,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
