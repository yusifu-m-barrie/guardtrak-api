import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalStorageProvider } from './local-storage.provider';

describe('LocalStorageProvider', () => {
  let root: string;
  let provider: LocalStorageProvider;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gt-storage-'));
    const config = {
      get: (key: string) => {
        if (key === 'storage.localRoot') {
          return root;
        }
        if (key === 'storage.publicUrl') {
          return '';
        }
        return undefined;
      },
    } as ConfigService;
    provider = new LocalStorageProvider(config);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('creates upload ticket and completes after putObject', async () => {
    const upload = await provider.createUploadUrl({
      organisationId: 'org',
      storageKey: 'org/inc/a.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 4,
      ttlSeconds: 900,
    });
    expect(upload.uploadUrl.startsWith('local-upload://')).toBe(true);
    const ticketId = upload.uploadUrl.replace('local-upload://', '');
    const written = provider.writeObjectFromTicket(
      ticketId,
      Buffer.from('test'),
    );
    expect(written.exists).toBe(true);
    expect(written.checksum).toHaveLength(64);

    const complete = await provider.completeUpload({
      storageKey: 'org/inc/a.jpg',
      expectedChecksum: written.checksum,
    });
    expect(complete.exists).toBe(true);
    expect(complete.checksum).toBe(written.checksum);
  });

  it('detects checksum mismatch on complete', async () => {
    provider.putObject('org/inc/b.jpg', Buffer.from('hello'));
    const complete = await provider.completeUpload({
      storageKey: 'org/inc/b.jpg',
      expectedChecksum: '0'.repeat(64),
    });
    expect(complete.exists).toBe(true);
    expect(complete.checksum).not.toBe('0'.repeat(64));
  });
});
