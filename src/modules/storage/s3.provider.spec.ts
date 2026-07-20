import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { S3Provider } from './s3.provider';

describe('S3Provider', () => {
  it('rejects createUploadUrl when storage credentials are missing', async () => {
    const config = {
      get: (key: string) => {
        if (key === 'storage.endpoint') {
          return '';
        }
        if (key === 'storage.bucket') {
          return '';
        }
        if (key === 'storage.accessKey') {
          return '';
        }
        if (key === 'storage.secretKey') {
          return '';
        }
        return undefined;
      },
    } as ConfigService;
    const provider = new S3Provider(config);

    await expect(
      provider.createUploadUrl({
        organisationId: 'org-1',
        storageKey: 'org/evidence/file.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        ttlSeconds: 900,
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.STORAGE_PROVIDER_UNSUPPORTED,
      },
    });
    await expect(
      provider.createUploadUrl({
        organisationId: 'org-1',
        storageKey: 'org/evidence/file.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        ttlSeconds: 900,
      }),
    ).rejects.toBeInstanceOf(AppException);
  });
});
