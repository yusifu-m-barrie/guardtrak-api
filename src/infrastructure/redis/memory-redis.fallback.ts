interface MemoryEntry {
  value: string;
  expiresAt: number | null;
}

/**
 * In-process Redis stand-in for development/test when REDIS_ENABLED=false.
 */
export class MemoryRedisFallback {
  private readonly store = new Map<string, MemoryEntry>();

  get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return Promise.resolve(null);
    }
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.value);
  }

  set(key: string, value: string, ttlSeconds?: number): Promise<'OK'> {
    const expiresAt =
      ttlSeconds !== undefined && ttlSeconds > 0
        ? Date.now() + ttlSeconds * 1000
        : null;
    this.store.set(key, { value, expiresAt });
    return Promise.resolve('OK');
  }

  del(key: string): Promise<number> {
    return Promise.resolve(this.store.delete(key) ? 1 : 0);
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const next = (current ? Number.parseInt(current, 10) || 0 : 0) + 1;
    const existing = this.store.get(key);
    this.store.set(key, {
      value: String(next),
      expiresAt: existing?.expiresAt ?? null,
    });
    return next;
  }

  expire(key: string, ttlSeconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) {
      return Promise.resolve(0);
    }
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return Promise.resolve(0);
    }
    entry.expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, entry);
    return Promise.resolve(1);
  }

  ping(): Promise<string> {
    return Promise.resolve('PONG');
  }

  clear(): void {
    this.store.clear();
  }
}
