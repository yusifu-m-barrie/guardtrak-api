import { hashRequestPayload } from './request-hash.util';

describe('hashRequestPayload', () => {
  it('returns a stable sha256 hex digest', () => {
    const payload = { action: 'clock-in', siteId: 'site-1' };
    const first = hashRequestPayload(payload);
    const second = hashRequestPayload(payload);

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is insensitive to object key order', () => {
    const a = hashRequestPayload({ b: 2, a: 1, nested: { z: 9, y: 8 } });
    const b = hashRequestPayload({ nested: { y: 8, z: 9 }, a: 1, b: 2 });

    expect(a).toBe(b);
  });

  it('changes when payload content changes', () => {
    const baseline = hashRequestPayload({ id: '1' });
    const changed = hashRequestPayload({ id: '2' });

    expect(baseline).not.toBe(changed);
  });
});
