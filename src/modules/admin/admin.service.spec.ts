import { AdminService } from './admin.service';

describe('AdminService', () => {
  const auditService = { record: jest.fn().mockResolvedValue(undefined) };
  const cacheService = {
    getStats: jest.fn().mockReturnValue({
      backend: 'memory',
      keys: 0,
      hits: 0,
      misses: 0,
    }),
    clearAll: jest.fn().mockResolvedValue(2),
  };
  const jobsService = {
    getMetrics: jest.fn().mockReturnValue({ backend: 'memory', queues: {} }),
    enqueueCleanup: jest.fn().mockResolvedValue({ jobId: 'job-1' }),
  };
  const metricsService = {
    toPrometheus: jest
      .fn()
      .mockReturnValue('process_resident_memory_bytes 123\n'),
  };
  const redisService = { isUsingRedis: jest.fn().mockReturnValue(false) };
  const healthService = {
    check: jest.fn().mockResolvedValue({ status: 'ok' }),
    readiness: jest.fn().mockResolvedValue({ status: 'ready' }),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'app.nodeEnv') return 'test';
      if (key === 'app.apiPrefix') return 'api/v1';
      if (key === 'storage.provider') return 'local';
      return undefined;
    }),
  };
  const prisma = {
    evidence: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { sizeBytes: 100 },
        _count: 1,
      }),
    },
    organisation: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const service = new AdminService(
    prisma as never,
    configService as never,
    auditService as never,
    cacheService as never,
    jobsService as never,
    metricsService as never,
    redisService as never,
    healthService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns system overview with redis and queue backend', () => {
    const result = service.getSystem();
    expect(result.nodeEnv).toBe('test');
    expect(result.redis).toBe('memory-fallback');
    expect(result.queues).toBe('memory');
  });

  it('clears cache and records audit', async () => {
    const actor = {
      id: 'user-1',
      organisationId: null,
      role: 'SUPER_ADMIN',
    } as never;
    const result = await service.clearCache(actor, 'req-1');
    expect(result.removed).toBe(2);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CACHE_CLEAR' }),
    );
  });

  it('lists background job catalogue from queue constants', () => {
    const jobs = service.getBackgroundJobs();
    expect(jobs.queues.length).toBeGreaterThan(0);
    expect(jobs.cleanupJobs).toContain('expired-sessions');
    expect(jobs.cleanupJobs).toContain('database-cleanup');
  });
});
