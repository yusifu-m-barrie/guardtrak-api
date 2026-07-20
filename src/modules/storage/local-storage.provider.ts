import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { dirname, join, resolve } from 'path';
import type {
  CompleteUploadInput,
  CompleteUploadResult,
  CreateUploadUrlInput,
  CreateUploadUrlResult,
  StorageProvider,
} from './storage.types';

interface LocalUploadTicket {
  storageKey: string;
  expiresAt: number;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Filesystem storage for development/test.
 * Upload URLs are opaque local tickets written under STORAGE_LOCAL_ROOT/.tickets/
 * Clients complete by POSTing bytes to the Nest complete endpoint (or writing
 * via the ticket path for e2e). For local provider, createUploadUrl returns a
 * relative API-style path; completeUpload validates the object on disk.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  private readonly root: string;

  constructor(private readonly configService: ConfigService) {
    this.root = resolve(
      this.configService.get<string>('storage.localRoot') ?? './storage',
    );
    mkdirSync(join(this.root, 'objects'), { recursive: true });
    mkdirSync(join(this.root, '.tickets'), { recursive: true });
  }

  createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult> {
    const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000);
    const ticketId = randomBytes(16).toString('hex');
    const ticket: LocalUploadTicket = {
      storageKey: input.storageKey,
      expiresAt: expiresAt.getTime(),
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    };
    writeFileSync(
      join(this.root, '.tickets', ticketId),
      JSON.stringify(ticket),
      'utf8',
    );
    // Local upload URL is a ticket the complete flow understands.
    const uploadUrl = `local-upload://${ticketId}`;
    return Promise.resolve({
      uploadUrl,
      storageKey: input.storageKey,
      expiresAt,
      method: 'PUT',
    });
  }

  /**
   * Materialise bytes for a local ticket (used by evidence complete + e2e).
   */
  writeObjectFromTicket(
    ticketId: string,
    body: Buffer,
    checksum?: string | null,
  ): CompleteUploadResult {
    const ticketPath = join(this.root, '.tickets', ticketId);
    if (!existsSync(ticketPath)) {
      return {
        storageKey: '',
        sizeBytes: 0,
        checksum: null,
        exists: false,
      };
    }
    const ticket = JSON.parse(
      readFileSync(ticketPath, 'utf8'),
    ) as LocalUploadTicket;
    if (ticket.expiresAt < Date.now()) {
      unlinkSync(ticketPath);
      return {
        storageKey: ticket.storageKey,
        sizeBytes: 0,
        checksum: null,
        exists: false,
      };
    }
    const objectPath = this.objectPath(ticket.storageKey);
    mkdirSync(dirname(objectPath), { recursive: true });
    writeFileSync(objectPath, body);
    unlinkSync(ticketPath);
    const computed = createHash('sha256').update(body).digest('hex');
    if (checksum && checksum !== computed) {
      return {
        storageKey: ticket.storageKey,
        sizeBytes: body.length,
        checksum: computed,
        exists: true,
      };
    }
    return {
      storageKey: ticket.storageKey,
      sizeBytes: body.length,
      checksum: computed,
      exists: true,
    };
  }

  async completeUpload(
    input: CompleteUploadInput,
  ): Promise<CompleteUploadResult> {
    const objectPath = this.objectPath(input.storageKey);
    if (!existsSync(objectPath)) {
      return {
        storageKey: input.storageKey,
        sizeBytes: 0,
        checksum: null,
        exists: false,
      };
    }
    const stats = statSync(objectPath);
    const hash = createHash('sha256');
    const stream = createReadStream(objectPath);
    await new Promise<void>((resolvePromise, reject) => {
      stream.on('data', (chunk: Buffer | string) => {
        hash.update(chunk);
      });
      stream.on('end', () => resolvePromise());
      stream.on('error', reject);
    });
    const checksum = hash.digest('hex');
    if (
      input.expectedChecksum &&
      input.expectedChecksum.toLowerCase() !== checksum
    ) {
      return {
        storageKey: input.storageKey,
        sizeBytes: stats.size,
        checksum,
        exists: true,
      };
    }
    if (
      input.expectedSizeBytes != null &&
      input.expectedSizeBytes !== stats.size
    ) {
      return {
        storageKey: input.storageKey,
        sizeBytes: stats.size,
        checksum,
        exists: true,
      };
    }
    return {
      storageKey: input.storageKey,
      sizeBytes: stats.size,
      checksum,
      exists: true,
    };
  }

  deleteObject(storageKey: string): Promise<void> {
    const objectPath = this.objectPath(storageKey);
    if (existsSync(objectPath)) {
      unlinkSync(objectPath);
    }
    return Promise.resolve();
  }

  getPublicUrl(storageKey: string): string {
    const base =
      this.configService.get<string>('storage.publicUrl')?.replace(/\/$/, '') ??
      '';
    if (base) {
      return `${base}/${storageKey}`;
    }
    return `file://${this.objectPath(storageKey)}`;
  }

  getSignedDownloadUrl(
    storageKey: string,
    ttlSeconds: number,
  ): Promise<{ downloadUrl: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const token = randomBytes(12).toString('hex');
    writeFileSync(
      join(this.root, '.tickets', `dl-${token}`),
      JSON.stringify({ storageKey, expiresAt: expiresAt.getTime() }),
      'utf8',
    );
    return Promise.resolve({
      downloadUrl: `local-download://${token}`,
      expiresAt,
    });
  }

  /** Ensure object exists for e2e/dev by writing placeholder bytes. */
  putObject(storageKey: string, body: Buffer): string {
    const objectPath = this.objectPath(storageKey);
    mkdirSync(dirname(objectPath), { recursive: true });
    writeFileSync(objectPath, body);
    return createHash('sha256').update(body).digest('hex');
  }

  private objectPath(storageKey: string): string {
    return join(this.root, 'objects', ...storageKey.split('/'));
  }
}
