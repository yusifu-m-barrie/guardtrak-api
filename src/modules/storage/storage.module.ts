import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudflareR2Provider } from './cloudflare-r2.provider';
import { NoOpThumbnailHook, THUMBNAIL_HOOK } from './hooks/thumbnail.hook';
import { NoOpVirusScanHook, VIRUS_SCAN_HOOK } from './hooks/virus-scan.hook';
import { LocalStorageController } from './local-storage.controller';
import { LocalStorageProvider } from './local-storage.provider';
import { S3Provider } from './s3.provider';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.types';

@Global()
@Module({
  controllers: [LocalStorageController],
  providers: [
    LocalStorageProvider,
    S3Provider,
    CloudflareR2Provider,
    { provide: VIRUS_SCAN_HOOK, useClass: NoOpVirusScanHook },
    { provide: THUMBNAIL_HOOK, useClass: NoOpThumbnailHook },
    {
      provide: STORAGE_PROVIDER,
      inject: [
        ConfigService,
        LocalStorageProvider,
        S3Provider,
        CloudflareR2Provider,
      ],
      useFactory: (
        config: ConfigService,
        local: LocalStorageProvider,
        s3: S3Provider,
        r2: CloudflareR2Provider,
      ): StorageProvider => {
        const provider = config.get<string>('storage.provider') ?? 'local';
        if (provider === 's3' || provider === 'minio') {
          return s3;
        }
        if (provider === 'r2') {
          return r2;
        }
        return local;
      },
    },
  ],
  exports: [
    STORAGE_PROVIDER,
    LocalStorageProvider,
    VIRUS_SCAN_HOOK,
    THUMBNAIL_HOOK,
  ],
})
export class StorageModule {}
