import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  AuditAction,
  EvidenceStatus,
  EvidenceType,
} from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import type { RequestUser } from '../../common/types/request-user.type';
import {
  requireOrganisationId,
  tenantNotFound,
  userHasPermission,
} from '../../common/tenant/tenant.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { JobsService } from '../../infrastructure/queues/jobs.service';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import type { ServiceRequestContext } from '../clients/clients.types';
import { IncidentAccessService } from '../incidents/incident-access.service';
import { LocalStorageProvider } from '../storage/local-storage.provider';
import {
  VIRUS_SCAN_HOOK,
  type VirusScanHook,
} from '../storage/hooks/virus-scan.hook';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../storage/storage.types';
import type { CompleteUploadDto } from './dto/complete-upload.dto';
import type { RequestUploadUrlDto } from './dto/request-upload-url.dto';
import { checksumsMatch, isValidSha256Hex } from './evidence-checksum.util';
import { toEvidenceResponse } from './mappers/evidence.mapper';

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuthAuditService,
    private readonly incidentAccess: IncidentAccessService,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
    private readonly localStorage: LocalStorageProvider,
    @Inject(VIRUS_SCAN_HOOK)
    private readonly virusScan: VirusScanHook,
    @Optional() private readonly jobsService?: JobsService,
  ) {}

  async requestUploadUrl(
    user: RequestUser,
    incidentId: string,
    dto: RequestUploadUrlDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, organisationId, deletedAt: null },
    });
    if (!incident) {
      tenantNotFound(ErrorCode.INCIDENT_NOT_FOUND);
    }
    await this.incidentAccess.assertCanReadIncident(
      user,
      organisationId,
      incident,
    );
    if (
      !userHasPermission(user, 'evidence:upload:self') &&
      !userHasPermission(user, 'evidence:manage')
    ) {
      throw new AppException(
        'Insufficient permissions',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      );
    }

    const maxImage =
      this.configService.get<number>('storage.maxImageSizeBytes') ?? 10_485_760;
    const maxVideo =
      this.configService.get<number>('storage.maxVideoSizeBytes') ??
      104_857_600;
    const isVideo = dto.type === EvidenceType.VIDEO;
    const maxAllowed = isVideo ? maxVideo : maxImage;
    if (dto.sizeBytes > maxAllowed) {
      throw new AppException(
        'File exceeds maximum allowed size',
        HttpStatus.BAD_REQUEST,
        ErrorCode.STORAGE_FILE_TOO_LARGE,
        [
          {
            field: 'sizeBytes',
            message: `Maximum ${maxAllowed} bytes for ${isVideo ? 'video' : 'image/document'}`,
            code: ErrorCode.STORAGE_FILE_TOO_LARGE,
          },
        ],
      );
    }

    if (!this.isAllowedMimeType(dto.type, dto.mimeType)) {
      throw new AppException(
        'Content type does not match evidence type',
        HttpStatus.BAD_REQUEST,
        ErrorCode.STORAGE_CONTENT_TYPE_INVALID,
        [
          {
            field: 'mimeType',
            message: `Unexpected mimeType ${dto.mimeType} for ${dto.type}`,
            code: ErrorCode.STORAGE_CONTENT_TYPE_INVALID,
          },
        ],
      );
    }

    const org = await this.prisma.organisation.findFirst({
      where: { id: organisationId, deletedAt: null },
      select: { storageQuotaBytes: true, storageUsedBytes: true },
    });
    if (org?.storageQuotaBytes != null) {
      const used = org.storageUsedBytes;
      const next = used + BigInt(dto.sizeBytes);
      if (next > org.storageQuotaBytes) {
        throw new AppException(
          'Organisation storage quota exceeded',
          HttpStatus.PAYLOAD_TOO_LARGE,
          ErrorCode.STORAGE_QUOTA_EXCEEDED,
        );
      }
    }

    const evidenceId = randomUUID();
    const ext = this.extensionFor(dto.originalFileName, dto.type);
    const storageKey = `${organisationId}/incidents/${incidentId}/${evidenceId}${ext}`;
    const ttl =
      this.configService.get<number>('storage.signedUrlTtlSeconds') ?? 900;
    const bucket = this.configService.get<string>('storage.bucket') || 'local';

    const upload = await this.storage.createUploadUrl({
      organisationId,
      storageKey,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      ttlSeconds: ttl,
    });

    const evidence = await this.prisma.evidence.create({
      data: {
        id: evidenceId,
        organisationId,
        uploadedByUserId: user.id,
        incidentId,
        type: dto.type,
        status: EvidenceStatus.PENDING_UPLOAD,
        originalFileName: dto.originalFileName,
        storageProvider: this.storage.name,
        storageBucket: bucket,
        storageKey,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
      },
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPLOAD,
      entityType: 'Evidence',
      entityId: evidence.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { incidentId, status: EvidenceStatus.PENDING_UPLOAD },
    });

    return {
      evidenceId: evidence.id,
      uploadUrl: upload.uploadUrl,
      storageKey: upload.storageKey,
      expiresAt: upload.expiresAt.toISOString(),
      method: upload.method,
    };
  }

  async completeUpload(
    user: RequestUser,
    incidentId: string,
    dto: CompleteUploadDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const evidence = await this.prisma.evidence.findFirst({
      where: {
        id: dto.evidenceId,
        incidentId,
        organisationId,
        deletedAt: null,
      },
    });
    if (!evidence) {
      tenantNotFound(ErrorCode.EVIDENCE_NOT_FOUND);
    }
    if (evidence.uploadedByUserId !== user.id) {
      if (!userHasPermission(user, 'evidence:manage')) {
        tenantNotFound(ErrorCode.EVIDENCE_NOT_FOUND);
      }
    }

    if (dto.checksum && !isValidSha256Hex(dto.checksum)) {
      throw new AppException(
        'Invalid checksum format',
        HttpStatus.BAD_REQUEST,
        ErrorCode.EVIDENCE_CHECKSUM_MISMATCH,
      );
    }

    // Local provider: accept base64 body via ticket for e2e
    if (
      this.storage.name === 'local' &&
      dto.localTicketId &&
      dto.localFileBase64
    ) {
      const body = Buffer.from(dto.localFileBase64, 'base64');
      const written = this.localStorage.writeObjectFromTicket(
        dto.localTicketId,
        body,
        dto.checksum,
      );
      if (!written.exists) {
        throw new AppException(
          'Upload ticket expired or missing',
          HttpStatus.BAD_REQUEST,
          ErrorCode.EVIDENCE_UPLOAD_INCOMPLETE,
        );
      }
      if (!checksumsMatch(dto.checksum, written.checksum)) {
        throw new AppException(
          'Checksum mismatch',
          HttpStatus.CONFLICT,
          ErrorCode.EVIDENCE_CHECKSUM_MISMATCH,
        );
      }
    } else if (this.storage.name === 'local' && dto.localFileBase64) {
      const body = Buffer.from(dto.localFileBase64, 'base64');
      const checksum = this.localStorage.putObject(evidence.storageKey, body);
      if (!checksumsMatch(dto.checksum, checksum)) {
        throw new AppException(
          'Checksum mismatch',
          HttpStatus.CONFLICT,
          ErrorCode.EVIDENCE_CHECKSUM_MISMATCH,
        );
      }
    }

    const complete = await this.storage.completeUpload({
      storageKey: evidence.storageKey,
      expectedChecksum: dto.checksum,
      expectedSizeBytes: evidence.sizeBytes,
    });
    if (!complete.exists) {
      throw new AppException(
        'Uploaded object not found in storage',
        HttpStatus.BAD_REQUEST,
        ErrorCode.EVIDENCE_UPLOAD_INCOMPLETE,
      );
    }
    if (!checksumsMatch(dto.checksum, complete.checksum)) {
      throw new AppException(
        'Checksum mismatch',
        HttpStatus.CONFLICT,
        ErrorCode.EVIDENCE_CHECKSUM_MISMATCH,
      );
    }

    await this.virusScan.scan(evidence.storageKey);

    let duplicateOf: string | null = null;
    if (complete.checksum) {
      const duplicate = await this.prisma.evidence.findFirst({
        where: {
          organisationId,
          checksum: complete.checksum,
          deletedAt: null,
          id: { not: evidence.id },
          status: EvidenceStatus.AVAILABLE,
        },
        select: { id: true },
      });
      duplicateOf = duplicate?.id ?? null;
    }

    const sizeBytes = complete.sizeBytes || evidence.sizeBytes;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.evidence.update({
        where: { id: evidence.id },
        data: {
          status: EvidenceStatus.AVAILABLE,
          checksum: complete.checksum,
          sizeBytes,
          uploadedAt: new Date(),
          processedAt: new Date(),
          metadata: duplicateOf ? { duplicateOf } : undefined,
        },
      });
      await tx.organisation.update({
        where: { id: organisationId },
        data: { storageUsedBytes: { increment: sizeBytes } },
      });
      return row;
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'Evidence',
      entityId: evidence.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        status: EvidenceStatus.AVAILABLE,
        duplicateOf,
      },
    });

    if (this.jobsService) {
      void this.jobsService
        .enqueueEvidenceProcess({
          evidenceId: updated.id,
          organisationId,
          storageKey: updated.storageKey,
        })
        .catch(() => undefined);
      void this.jobsService
        .enqueueThumbnail({
          evidenceId: updated.id,
          storageKey: updated.storageKey,
          mimeType: updated.mimeType,
        })
        .catch(() => undefined);
    }

    return toEvidenceResponse(updated);
  }

  async listForIncident(user: RequestUser, incidentId: string) {
    const organisationId = requireOrganisationId(user);
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, organisationId, deletedAt: null },
    });
    if (!incident) {
      tenantNotFound(ErrorCode.INCIDENT_NOT_FOUND);
    }
    await this.incidentAccess.assertCanReadIncident(
      user,
      organisationId,
      incident,
    );
    const userSelect = {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      displayName: true,
      avatarUrl: true,
    } as const;
    const rows = await this.prisma.evidence.findMany({
      where: { incidentId, organisationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedByUser: { select: userSelect },
        verifiedByUser: { select: userSelect },
      },
    });
    const visible =
      userHasPermission(user, 'evidence:read') ||
      userHasPermission(user, 'evidence:manage')
        ? rows
        : rows.filter((r) => r.uploadedByUserId === user.id);

    const ttl =
      this.configService.get<number>('storage.signedUrlTtlSeconds') ?? 900;

    return Promise.all(
      visible.map(async (row) => {
        if (
          row.status === EvidenceStatus.AVAILABLE ||
          row.status === EvidenceStatus.UPLOADED
        ) {
          try {
            const signed = await this.storage.getSignedDownloadUrl(
              row.storageKey,
              ttl,
            );
            return toEvidenceResponse(row, {
              downloadUrl: signed.downloadUrl,
              downloadExpiresAt: signed.expiresAt.toISOString(),
            });
          } catch {
            return toEvidenceResponse(row);
          }
        }
        return toEvidenceResponse(row);
      }),
    );
  }

  async softDelete(
    user: RequestUser,
    incidentId: string,
    evidenceId: string,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    if (
      !userHasPermission(user, 'evidence:delete') &&
      !userHasPermission(user, 'evidence:manage')
    ) {
      throw new AppException(
        'Insufficient permissions',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      );
    }
    const evidence = await this.prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        incidentId,
        organisationId,
        deletedAt: null,
      },
    });
    if (!evidence) {
      tenantNotFound(ErrorCode.EVIDENCE_NOT_FOUND);
    }
    const updated = await this.prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        deletedAt: new Date(),
        deletedByUserId: user.id,
        status: EvidenceStatus.DELETED,
      },
    });
    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.DELETE,
      entityType: 'Evidence',
      entityId: evidenceId,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return toEvidenceResponse(updated);
  }

  async verify(
    user: RequestUser,
    incidentId: string,
    evidenceId: string,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    if (
      !userHasPermission(user, 'evidence:verify') &&
      !userHasPermission(user, 'evidence:manage')
    ) {
      throw new AppException(
        'Insufficient permissions',
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      );
    }
    const evidence = await this.prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        incidentId,
        organisationId,
        deletedAt: null,
      },
    });
    if (!evidence) {
      tenantNotFound(ErrorCode.EVIDENCE_NOT_FOUND);
    }
    if (evidence.verified) {
      throw new AppException(
        'Evidence already verified',
        HttpStatus.CONFLICT,
        ErrorCode.EVIDENCE_ALREADY_VERIFIED,
      );
    }
    if (evidence.status !== EvidenceStatus.AVAILABLE) {
      throw new AppException(
        'Evidence must be AVAILABLE to verify',
        HttpStatus.CONFLICT,
        ErrorCode.EVIDENCE_STATUS_INVALID,
      );
    }
    const updated = await this.prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        verified: true,
        verifiedByUserId: user.id,
        verifiedAt: new Date(),
      },
    });
    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.APPROVE,
      entityType: 'Evidence',
      entityId: evidenceId,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return toEvidenceResponse(updated);
  }

  private extensionFor(fileName: string, type: EvidenceType): string {
    const dot = fileName.lastIndexOf('.');
    if (dot > 0 && dot < fileName.length - 1) {
      return fileName.slice(dot).toLowerCase().slice(0, 16);
    }
    switch (type) {
      case EvidenceType.IMAGE:
        return '.jpg';
      case EvidenceType.VIDEO:
        return '.mp4';
      case EvidenceType.AUDIO:
        return '.m4a';
      case EvidenceType.DOCUMENT:
        return '.pdf';
      default:
        return '.bin';
    }
  }

  private isAllowedMimeType(type: EvidenceType, mimeType: string): boolean {
    const mime = mimeType.toLowerCase().trim();
    switch (type) {
      case EvidenceType.IMAGE:
        return mime.startsWith('image/');
      case EvidenceType.VIDEO:
        return mime.startsWith('video/');
      case EvidenceType.AUDIO:
        return mime.startsWith('audio/');
      case EvidenceType.DOCUMENT:
        return (
          mime === 'application/pdf' ||
          mime.startsWith('text/') ||
          mime === 'application/msword' ||
          mime.startsWith('application/vnd.')
        );
      default:
        return mime.length > 0;
    }
  }
}
