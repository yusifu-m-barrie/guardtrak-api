export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface CreateUploadUrlInput {
  organisationId: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  ttlSeconds: number;
}

export interface CreateUploadUrlResult {
  uploadUrl: string;
  storageKey: string;
  expiresAt: Date;
  method: 'PUT';
}

export interface CompleteUploadInput {
  storageKey: string;
  expectedChecksum?: string | null;
  expectedSizeBytes?: number | null;
}

export interface CompleteUploadResult {
  storageKey: string;
  sizeBytes: number;
  checksum: string | null;
  exists: boolean;
}

export interface StorageProvider {
  readonly name: string;
  createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult>;
  completeUpload(input: CompleteUploadInput): Promise<CompleteUploadResult>;
  deleteObject(storageKey: string): Promise<void>;
  getPublicUrl(storageKey: string): string;
  getSignedDownloadUrl(
    storageKey: string,
    ttlSeconds: number,
  ): Promise<{ downloadUrl: string; expiresAt: Date }>;
}
