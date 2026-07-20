import { MemoryRedisFallback } from './memory-redis.fallback';

describe('MemoryRedisFallback', () => {
  let fallback: MemoryRedisFallback;

  beforeEach(() => {
    fallback = new MemoryRedisFallback();
  });

  it('stores and retrieves values', async () => {
    await fallback.set('key', 'value');
    await expect(fallback.get('key')).resolves.toBe('value');
  });

  it('returns null for missing keys', async () => {
    await expect(fallback.get('missing')).resolves.toBeNull();
  });

  it('expires keys after ttl', async () => {
    await fallback.set('ttl-key', 'temp', 1);
    await expect(fallback.get('ttl-key')).resolves.toBe('temp');

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await expect(fallback.get('ttl-key')).resolves.toBeNull();
  });

  it('deletes keys', async () => {
    await fallback.set('delete-me', 'value');
    await fallback.del('delete-me');
    await expect(fallback.get('delete-me')).resolves.toBeNull();
  });

  it('increments numeric values', async () => {
    await fallback.set('counter', '1');
    await expect(fallback.incr('counter')).resolves.toBe(2);
    await expect(fallback.incr('counter')).resolves.toBe(3);
  });

  it('responds to ping', async () => {
    await expect(fallback.ping()).resolves.toBe('PONG');
  });

  it('clears the store', async () => {
    await fallback.set('a', '1');
    fallback.clear();
    await expect(fallback.get('a')).resolves.toBeNull();
  });
});
