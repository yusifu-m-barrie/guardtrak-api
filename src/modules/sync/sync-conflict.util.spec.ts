import { detectSyncConflict } from './sync-conflict.util';

describe('detectSyncConflict', () => {
  it('returns no conflict for fresh operation', () => {
    expect(
      detectSyncConflict({
        operationId: 'op1',
        entityType: 'incident.create',
      }),
    ).toEqual({ isConflict: false });
  });

  it('detects payload divergence', () => {
    const result = detectSyncConflict({
      operationId: 'op1',
      entityType: 'incident.create',
      localEntityId: 'local-1',
      existingServerEntityId: 'server-1',
      payloadChanged: true,
    });
    expect(result.isConflict).toBe(true);
    expect(result.reasonCode).toBe('PAYLOAD_DIVERGED');
  });
});
