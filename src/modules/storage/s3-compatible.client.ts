import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import type {
  CompleteUploadInput,
  CompleteUploadResult,
  CreateUploadUrlInput,
  CreateUploadUrlResult,
} from './storage.types';

export interface S3ClientProfile {
  forcePathStyle: boolean;
  defaultRegion?: string;
}

export class S3CompatibleClient {
  private client: S3Client | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly profile: S3ClientProfile,
  ) {}

  createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult> {
    const client = this.getClient();
    const bucket = this.requireBucket();
    const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: input.storageKey,
      ContentType: input.mimeType,
      ContentLength: input.sizeBytes,
    });
    return getSignedUrl(client, command, {
      expiresIn: input.ttlSeconds,
    }).then((uploadUrl) => ({
      uploadUrl,
      storageKey: input.storageKey,
      expiresAt,
      method: 'PUT' as const,
    }));
  }

  async completeUpload(
    input: CompleteUploadInput,
  ): Promise<CompleteUploadResult> {
    const client = this.getClient();
    const bucket = this.requireBucket();
    try {
      const head = await client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: input.storageKey,
        }),
      );
      const sizeBytes = head.ContentLength ?? 0;
      if (
        input.expectedSizeBytes != null &&
        input.expectedSizeBytes !== sizeBytes
      ) {
        const checksum = this.extractChecksum(head.Metadata, head.ETag);
        return {
          storageKey: input.storageKey,
          sizeBytes,
          checksum,
          exists: true,
        };
      }
      const checksum = this.extractChecksum(head.Metadata, head.ETag);
      if (
        input.expectedChecksum &&
        checksum &&
        input.expectedChecksum.toLowerCase() !== checksum.toLowerCase()
      ) {
        return {
          storageKey: input.storageKey,
          sizeBytes,
          checksum,
          exists: true,
        };
      }
      return {
        storageKey: input.storageKey,
        sizeBytes,
        checksum,
        exists: true,
      };
    } catch (error) {
      if (error instanceof NotFound) {
        return {
          storageKey: input.storageKey,
          sizeBytes: 0,
          checksum: null,
          exists: false,
        };
      }
      throw error;
    }
  }

  deleteObject(storageKey: string): Promise<void> {
    const client = this.getClient();
    const bucket = this.requireBucket();
    return client
      .send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: storageKey,
        }),
      )
      .then(() => undefined);
  }

  getPublicUrl(storageKey: string): string {
    const bucket = this.requireBucket();
    const publicUrl = this.configService
      .get<string>('storage.publicUrl')
      ?.replace(/\/$/, '');
    if (publicUrl) {
      return `${publicUrl}/${storageKey}`;
    }
    const endpoint = this.configService.get<string>('storage.endpoint') ?? '';
    const region =
      this.profile.defaultRegion ??
      this.configService.get<string>('storage.region') ??
      'us-east-1';
    if (endpoint) {
      const base = endpoint.replace(/\/$/, '');
      return this.profile.forcePathStyle
        ? `${base}/${bucket}/${storageKey}`
        : `${base}/${storageKey}`;
    }
    return `https://${bucket}.s3.${region}.amazonaws.com/${storageKey}`;
  }

  getSignedDownloadUrl(
    storageKey: string,
    ttlSeconds: number,
  ): Promise<{ downloadUrl: string; expiresAt: Date }> {
    const client = this.getClient();
    const bucket = this.requireBucket();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    });
    return getSignedUrl(client, command, { expiresIn: ttlSeconds }).then(
      (downloadUrl) => ({ downloadUrl, expiresAt }),
    );
  }

  private getClient(): S3Client {
    this.assertConfigured();
    if (!this.client) {
      const accessKey =
        this.configService.get<string>('storage.accessKey') ?? '';
      const secretKey =
        this.configService.get<string>('storage.secretKey') ?? '';
      const endpoint =
        this.configService.get<string>('storage.endpoint') || undefined;
      const region =
        this.profile.defaultRegion ??
        this.configService.get<string>('storage.region') ??
        'us-east-1';
      this.client = new S3Client({
        region,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
        ...(endpoint
          ? { endpoint, forcePathStyle: this.profile.forcePathStyle }
          : {}),
      });
    }
    return this.client;
  }

  private assertConfigured(): void {
    const accessKey = this.configService.get<string>('storage.accessKey') ?? '';
    const secretKey = this.configService.get<string>('storage.secretKey') ?? '';
    const bucket = this.configService.get<string>('storage.bucket') ?? '';
    if (!accessKey || !secretKey || !bucket) {
      throw new AppException(
        'Object storage credentials are not configured',
        HttpStatus.NOT_IMPLEMENTED,
        ErrorCode.STORAGE_PROVIDER_UNSUPPORTED,
      );
    }
  }

  private requireBucket(): string {
    this.assertConfigured();
    return this.configService.get<string>('storage.bucket') ?? '';
  }

  private extractChecksum(
    metadata: Record<string, string> | undefined,
    etag: string | undefined,
  ): string | null {
    if (metadata?.checksum) {
      return metadata.checksum;
    }
    if (etag) {
      return etag.replace(/"/g, '');
    }
    return null;
  }
}
