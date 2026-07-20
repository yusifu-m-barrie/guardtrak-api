import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EvidenceStatus } from '../../../generated/prisma/client';
import type { RequestUser } from '../../common/types/request-user.type';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { JobsService } from '../../infrastructure/queues/jobs.service';
import {
  AUDIT_CLEANUP_JOB,
  DATABASE_CLEANUP_JOB,
  EXPIRED_SESSIONS_JOB,
  INACTIVE_DEVICES_JOB,
  INCIDENT_ESCALATION_JOB,
  NOTIFICATION_RETRY_JOB,
  OTP_CLEANUP_JOB,
  PASSWORD_RESET_CLEANUP_JOB,
  QUEUE_NAMES,
  REFRESH_TOKEN_CLEANUP_JOB,
} from '../../infrastructure/queues/queue.names';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { HealthService } from '../../health/health.service';

@Injectable()
export class AdminService {
  private queuesPaused = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuthAuditService,
    private readonly cacheService: CacheService,
    private readonly jobsService: JobsService,
    private readonly metricsService: MetricsService,
    private readonly redisService: RedisService,
    private readonly healthService: HealthService,
  ) {}

  getSystem() {
    const mem = process.memoryUsage();
    return {
      application: 'guardtrak-api',
      nodeEnv: this.configService.get<string>('app.nodeEnv') ?? 'development',
      apiPrefix: this.configService.get<string>('app.apiPrefix') ?? 'api/v1',
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
      },
      redis: this.redisService.isUsingRedis() ? 'connected' : 'memory-fallback',
      queues: this.jobsService.getMetrics().backend,
      queuesPaused: this.queuesPaused,
      storageProvider:
        this.configService.get<string>('storage.provider') ?? 'local',
    };
  }

  async getSystemHealth() {
    const [health, ready] = await Promise.all([
      this.healthService.check(),
      this.healthService.readiness(),
    ]);
    return { health, ready };
  }

  getMetricsSummary() {
    const text = this.metricsService.toPrometheus();
    const mem = process.memoryUsage();
    return {
      prometheusPreview: text.slice(0, 2000),
      process: {
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
      },
      cache: this.cacheService.getStats(),
      queues: this.jobsService.getMetrics(),
    };
  }

  getCache() {
    return this.cacheService.getStats();
  }

  async clearCache(actor: RequestUser, requestId?: string | null) {
    const removed = await this.cacheService.clearAll();
    await this.auditService.record({
      organisationId: actor.organisationId,
      actorUserId: actor.id,
      action: AuditAction.CACHE_CLEAR,
      entityType: 'Cache',
      entityId: null,
      requestId: requestId ?? null,
      metadata: { removed, event: 'admin_cache_clear' },
    });
    return { removed };
  }

  async getStorageOverview() {
    const [agg, orgs] = await Promise.all([
      this.prisma.evidence.aggregate({
        where: { deletedAt: null, status: EvidenceStatus.AVAILABLE },
        _sum: { sizeBytes: true },
        _count: true,
      }),
      this.prisma.organisation.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          code: true,
          storageQuotaBytes: true,
          storageUsedBytes: true,
        },
        take: 50,
        orderBy: { code: 'asc' },
      }),
    ]);
    return {
      evidenceReadyCount: agg._count,
      evidenceReadyBytes: agg._sum.sizeBytes ?? 0,
      organisations: orgs.map((o) => ({
        id: o.id,
        code: o.code,
        storageQuotaBytes: o.storageQuotaBytes?.toString() ?? null,
        storageUsedBytes: o.storageUsedBytes.toString(),
      })),
    };
  }

  getQueues() {
    return {
      paused: this.queuesPaused,
      metrics: this.jobsService.getMetrics(),
      names: Object.values(QUEUE_NAMES),
    };
  }

  async pauseQueues(actor: RequestUser, requestId?: string | null) {
    this.queuesPaused = true;
    await this.auditService.record({
      organisationId: actor.organisationId,
      actorUserId: actor.id,
      action: AuditAction.ADMIN_ACTION,
      entityType: 'Queue',
      entityId: null,
      requestId: requestId ?? null,
      metadata: { event: 'queues_pause' },
    });
    return { paused: true };
  }

  async resumeQueues(actor: RequestUser, requestId?: string | null) {
    this.queuesPaused = false;
    await this.auditService.record({
      organisationId: actor.organisationId,
      actorUserId: actor.id,
      action: AuditAction.ADMIN_ACTION,
      entityType: 'Queue',
      entityId: null,
      requestId: requestId ?? null,
      metadata: { event: 'queues_resume' },
    });
    return { paused: false };
  }

  async retryQueues(actor: RequestUser, requestId?: string | null) {
    const job = await this.jobsService.enqueueCleanup({
      task: 'retry-dlq',
      requestedBy: actor.id,
    });
    await this.auditService.record({
      organisationId: actor.organisationId,
      actorUserId: actor.id,
      action: AuditAction.QUEUE_RETRY,
      entityType: 'Queue',
      entityId: job.jobId,
      requestId: requestId ?? null,
      metadata: { event: 'queues_retry' },
    });
    return { jobId: job.jobId };
  }

  getBackgroundJobs() {
    return {
      queues: Object.entries(QUEUE_NAMES).map(([key, name]) => ({
        key,
        name,
      })),
      cleanupJobs: [
        REFRESH_TOKEN_CLEANUP_JOB,
        EXPIRED_SESSIONS_JOB,
        OTP_CLEANUP_JOB,
        PASSWORD_RESET_CLEANUP_JOB,
        INACTIVE_DEVICES_JOB,
        INCIDENT_ESCALATION_JOB,
        AUDIT_CLEANUP_JOB,
        DATABASE_CLEANUP_JOB,
        NOTIFICATION_RETRY_JOB,
        'retry-dlq',
      ],
    };
  }

  async countDevicesByStatus() {
    const groups = await this.prisma.device.groupBy({
      by: ['status'],
      _count: true,
    });
    return groups.map((g) => ({
      status: g.status,
      count: g._count,
    }));
  }
}
