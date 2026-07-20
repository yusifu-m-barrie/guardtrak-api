import { CacheService } from './cache.service';

describe('CacheService (memory)', () => {
  it('sets and gets values with TTL semantics', async () => {
    const redis = {
      isUsingRedis: () => false,
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
    const cache = new CacheService(redis as never);

    await cache.setJson('k1', { a: 1 }, 60);
    await expect(cache.getJson<{ a: number }>('k1')).resolves.toEqual({ a: 1 });
    await cache.del('k1');
    await expect(cache.getJson('k1')).resolves.toBeNull();

    const removed = await cache.clearPrefix('pref:');
    expect(removed).toBe(0);

    const stats = cache.getStats();
    expect(stats.backend).toBe('memory');
    expect(stats.hits).toBeGreaterThanOrEqual(1);
    expect(stats.misses).toBeGreaterThanOrEqual(1);
  });
});
