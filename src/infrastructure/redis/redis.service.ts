import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { MemoryRedisFallback } from './memory-redis.fallback';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly memory = new MemoryRedisFallback();
  private enabled = false;
  private keyPrefix = 'guardtrak:';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.enabled = this.configService.get<boolean>('redis.enabled') === true;
    this.keyPrefix =
      this.configService.get<string>('redis.keyPrefix') ?? 'guardtrak:';

    if (!this.enabled) {
      this.logger.log('Redis disabled — using in-memory fallback');
      return;
    }

    const url =
      this.configService.get<string>('redis.url') ?? 'redis://localhost:6379';
    try {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
      await this.client.connect();
      this.logger.log('Redis connected');
    } catch (error) {
      this.logger.warn(
        `Redis connection failed — falling back to memory: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      if (this.client) {
        this.client.disconnect();
        this.client = null;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
      this.client = null;
    }
  }

  isUsingRedis(): boolean {
    return this.client !== null;
  }

  private prefixed(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get(key: string): Promise<string | null> {
    const full = this.prefixed(key);
    if (this.client) {
      return this.client.get(full);
    }
    return this.memory.get(full);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK'> {
    const full = this.prefixed(key);
    if (this.client) {
      if (ttlSeconds !== undefined && ttlSeconds > 0) {
        await this.client.set(full, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(full, value);
      }
      return 'OK';
    }
    return this.memory.set(full, value, ttlSeconds);
  }

  async del(key: string): Promise<number> {
    const full = this.prefixed(key);
    if (this.client) {
      return this.client.del(full);
    }
    return this.memory.del(full);
  }

  async incr(key: string): Promise<number> {
    const full = this.prefixed(key);
    if (this.client) {
      return this.client.incr(full);
    }
    return this.memory.incr(full);
  }

  async expire(key: string, ttlSeconds: number): Promise<number> {
    const full = this.prefixed(key);
    if (this.client) {
      return this.client.expire(full, ttlSeconds);
    }
    return this.memory.expire(full, ttlSeconds);
  }

  /**
   * Placeholder distributed lock — returns true when acquired.
   * Full Redlock semantics deferred.
   */
  async acquireLock(
    key: string,
    ttlSeconds = 30,
    token = '1',
  ): Promise<boolean> {
    const full = this.prefixed(`lock:${key}`);
    if (this.client) {
      const result = await this.client.set(full, token, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    }
    const existing = await this.memory.get(full);
    if (existing) {
      return false;
    }
    await this.memory.set(full, token, ttlSeconds);
    return true;
  }

  async healthCheck(): Promise<{ status: 'up' | 'down' | 'memory' }> {
    if (this.client) {
      try {
        const pong = await this.client.ping();
        return { status: pong === 'PONG' ? 'up' : 'down' };
      } catch {
        return { status: 'down' };
      }
    }
    return { status: 'memory' };
  }
}
