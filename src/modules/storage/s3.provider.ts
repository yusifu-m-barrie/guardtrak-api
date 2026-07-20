import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3CompatibleClient } from './s3-compatible.client';
import type {
  CompleteUploadInput,
  CompleteUploadResult,
  CreateUploadUrlInput,
  CreateUploadUrlResult,
  StorageProvider,
} from './storage.types';

@Injectable()
export class S3Provider implements StorageProvider {
  readonly name = 's3';
  private client: S3CompatibleClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  private rejectIfNeeded(error: unknown): Promise<never> {
    return Promise.reject(
      error instanceof Error ? error : new Error(String(error)),
    );
  }

  createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult> {
    try {
      return this.getClient().createUploadUrl(input);
    } catch (error) {
      return this.rejectIfNeeded(error);
    }
  }

  completeUpload(input: CompleteUploadInput): Promise<CompleteUploadResult> {
    try {
      return this.getClient().completeUpload(input);
    } catch (error) {
      return this.rejectIfNeeded(error);
    }
  }

  deleteObject(storageKey: string): Promise<void> {
    try {
      return this.getClient().deleteObject(storageKey);
    } catch (error) {
      return this.rejectIfNeeded(error);
    }
  }

  getPublicUrl(storageKey: string): string {
    return this.getClient().getPublicUrl(storageKey);
  }

  getSignedDownloadUrl(
    storageKey: string,
    ttlSeconds: number,
  ): Promise<{ downloadUrl: string; expiresAt: Date }> {
    try {
      return this.getClient().getSignedDownloadUrl(storageKey, ttlSeconds);
    } catch (error) {
      return this.rejectIfNeeded(error);
    }
  }

  private getClient(): S3CompatibleClient {
    if (!this.client) {
      const endpoint = this.configService.get<string>('storage.endpoint') ?? '';
      this.client = new S3CompatibleClient(this.configService, {
        forcePathStyle: endpoint.length > 0,
      });
    }
    return this.client;
  }
}
