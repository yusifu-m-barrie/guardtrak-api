import { Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from '../metrics/metrics.service';

interface MemoryCacheEntry {
  value: string;
  expiresAt: number | null;
}

export interface CacheStats {
  backend: 'redis' | 'memory';
  keys: number;
  hits: number;
  misses: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly memory = new Map<string, MemoryCacheEntry>();
  private hits = 0;
  private misses = 0;
  private readonly prefix = 'cache:';

  constructor(
    private readonly redis: RedisService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async get(key: string): Promise<string | null> {
    const full = this.prefix + key;
    if (this.redis.isUsingRedis()) {
      const value = await this.redis.get(full);
      if (value === null) {
        this.misses += 1;
        this.metrics?.recordCache('miss');
        return null;
      }
      this.hits += 1;
      this.metrics?.recordCache('hit');
      return value;
    }
    const entry = this.memory.get(full);
    if (!entry) {
      this.misses += 1;
      this.metrics?.recordCache('miss');
      return null;
    }
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.memory.delete(full);
      this.misses += 1;
      this.metrics?.recordCache('miss');
      return null;
    }
    this.hits += 1;
    this.metrics?.recordCache('hit');
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const full = this.prefix + key;
    if (this.redis.isUsingRedis()) {
      await this.redis.set(full, value, ttlSeconds);
      return;
    }
    this.memory.set(full, {
      value,
      expiresAt:
        ttlSeconds !== undefined && ttlSeconds > 0
          ? Date.now() + ttlSeconds * 1000
          : null,
    });
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (raw === null) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`Invalid JSON in cache key ${key}`);
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async del(key: string): Promise<void> {
    const full = this.prefix + key;
    if (this.redis.isUsingRedis()) {
      await this.redis.del(full);
      return;
    }
    this.memory.delete(full);
  }

  clearPrefix(prefix = ''): Promise<number> {
    const match = this.prefix + prefix;
    if (this.redis.isUsingRedis()) {
      this.logger.debug(
        `Redis clearPrefix(${match}) — iterative delete not implemented; clearing memory only`,
      );
    }
    let removed = 0;
    for (const key of [...this.memory.keys()]) {
      if (key.startsWith(match)) {
        this.memory.delete(key);
        removed += 1;
      }
    }
    return Promise.resolve(removed);
  }

  async clearAll(): Promise<number> {
    return this.clearPrefix('');
  }

  getStats(): CacheStats {
    return {
      backend: this.redis.isUsingRedis() ? 'redis' : 'memory',
      keys: this.memory.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}
