import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  CheckpointVerificationMethod,
  PatrolAssignmentStatus,
  PatrolRouteStatus,
  Prisma,
} from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import type { RequestUser } from '../../common/types/request-user.type';
import {
  requireOrganisationId,
  tenantNotFound,
} from '../../common/tenant/tenant.util';
import {
  normalizePersonName,
  trimOrUndefined,
} from '../../common/utils/normalize.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import type { ServiceRequestContext } from '../clients/clients.types';
import { GeofenceService } from '../attendance/geofence.service';
import { hashQrCode } from '../patrols/patrol-qr.util';
import type { BatchCreatePatrolCheckpointsDto } from './dto/batch-create-patrol-checkpoints.dto';
import type { CreatePatrolCheckpointDto } from './dto/create-patrol-checkpoint.dto';
import type { ReorderPatrolCheckpointsDto } from './dto/reorder-patrol-checkpoints.dto';
import type { UpdatePatrolCheckpointDto } from './dto/update-patrol-checkpoint.dto';
import { toPatrolCheckpointResponse } from './mappers/patrol-checkpoint.mapper';

@Injectable()
export class PatrolCheckpointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuthAuditService,
    private readonly configService: ConfigService,
    private readonly geofenceService: GeofenceService,
  ) {}

  async create(
    user: RequestUser,
    routeId: string,
    dto: CreatePatrolCheckpointDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    await this.assertRouteEditable(organisationId, routeId);
    const prepared = this.prepareCheckpointInput(dto);
    await this.assertSequenceAvailable(
      organisationId,
      routeId,
      prepared.sequence,
    );
    if (prepared.qrCodeHash) {
      await this.assertQrHashAvailable(organisationId, prepared.qrCodeHash);
    }

    const checkpoint = await this.prisma.patrolCheckpoint.create({
      data: {
        organisationId,
        patrolRouteId: routeId,
        ...prepared,
      },
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      entityType: 'PatrolCheckpoint',
      entityId: checkpoint.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return toPatrolCheckpointResponse(checkpoint);
  }

  async createBatch(
    user: RequestUser,
    routeId: string,
    dto: BatchCreatePatrolCheckpointsDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    await this.assertRouteEditable(organisationId, routeId);

    const prepared = dto.checkpoints.map((item) =>
      this.prepareCheckpointInput(item),
    );
    const sequences = prepared.map((p) => p.sequence);
    if (new Set(sequences).size !== sequences.length) {
      throw new AppException(
        'Duplicate sequences in batch request',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_CHECKPOINT_SEQUENCE_CONFLICT,
      );
    }
    const hashes = prepared
      .map((p) => p.qrCodeHash)
      .filter((h): h is string => Boolean(h));
    if (new Set(hashes).size !== hashes.length) {
      throw new AppException(
        'Duplicate QR values in batch request',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_CHECKPOINT_QR_CONFLICT,
      );
    }

    for (const item of prepared) {
      await this.assertSequenceAvailable(
        organisationId,
        routeId,
        item.sequence,
      );
      if (item.qrCodeHash) {
        await this.assertQrHashAvailable(organisationId, item.qrCodeHash);
      }
    }

    const created = await this.prisma.$transaction(
      prepared.map((item) =>
        this.prisma.patrolCheckpoint.create({
          data: {
            organisationId,
            patrolRouteId: routeId,
            ...item,
          },
        }),
      ),
    );

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      entityType: 'PatrolCheckpoint',
      entityId: routeId,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        batch: true,
        checkpointIds: created.map((c) => c.id),
        count: created.length,
      },
    });

    return created
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((c) => toPatrolCheckpointResponse(c));
  }

  async listByRoute(user: RequestUser, routeId: string) {
    const organisationId = requireOrganisationId(user);
    await this.assertRouteReadable(organisationId, routeId);
    const items = await this.prisma.patrolCheckpoint.findMany({
      where: {
        organisationId,
        patrolRouteId: routeId,
        deletedAt: null,
      },
      orderBy: { sequence: 'asc' },
    });
    return items.map((c) => toPatrolCheckpointResponse(c));
  }

  async findOne(user: RequestUser, id: string) {
    const organisationId = requireOrganisationId(user);
    const checkpoint = await this.findCheckpointOrThrow(organisationId, id);
    return toPatrolCheckpointResponse(checkpoint);
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdatePatrolCheckpointDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findCheckpointOrThrow(organisationId, id);
    await this.assertRouteEditable(organisationId, existing.patrolRouteId);

    if (
      dto.verificationMethod !== undefined ||
      dto.qrCodeValue !== undefined ||
      dto.sequence !== undefined ||
      dto.latitude !== undefined ||
      dto.longitude !== undefined ||
      dto.allowedRadiusMeters !== undefined
    ) {
      await this.assertNoActiveAssignmentsUsingCheckpoint(
        organisationId,
        existing.id,
      );
    }

    const nextMethod = dto.verificationMethod ?? existing.verificationMethod;
    let qrCodeHash: string | null | undefined = undefined;
    let qrCodeValue: string | null | undefined = undefined;

    if (dto.qrCodeValue !== undefined) {
      if (dto.qrCodeValue === null || dto.qrCodeValue.trim() === '') {
        qrCodeHash = null;
        qrCodeValue = null;
      } else {
        qrCodeHash = hashQrCode(dto.qrCodeValue);
        qrCodeValue = dto.qrCodeValue.trim();
        await this.assertQrHashAvailable(
          organisationId,
          qrCodeHash,
          existing.id,
        );
      }
    }

    const effectiveHash =
      qrCodeHash !== undefined ? qrCodeHash : existing.qrCodeHash;
    this.assertQrRequirement(nextMethod, effectiveHash);

    if (dto.sequence !== undefined && dto.sequence !== existing.sequence) {
      await this.assertSequenceAvailable(
        organisationId,
        existing.patrolRouteId,
        dto.sequence,
        existing.id,
      );
    }

    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      this.geofenceService.validateCoordinates(
        dto.latitude ?? Number(existing.latitude),
        dto.longitude ?? Number(existing.longitude),
      );
    }
    if (dto.allowedRadiusMeters !== undefined) {
      this.assertRadius(dto.allowedRadiusMeters);
    }

    const updated = await this.prisma.patrolCheckpoint.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined
          ? { name: normalizePersonName(dto.name) }
          : {}),
        ...(dto.description !== undefined
          ? { description: trimOrUndefined(dto.description) ?? null }
          : {}),
        ...(dto.sequence !== undefined ? { sequence: dto.sequence } : {}),
        ...(dto.latitude !== undefined
          ? { latitude: new Prisma.Decimal(dto.latitude) }
          : {}),
        ...(dto.longitude !== undefined
          ? { longitude: new Prisma.Decimal(dto.longitude) }
          : {}),
        ...(dto.allowedRadiusMeters !== undefined
          ? { allowedRadiusMeters: dto.allowedRadiusMeters }
          : {}),
        ...(dto.verificationMethod !== undefined
          ? { verificationMethod: dto.verificationMethod }
          : {}),
        ...(qrCodeHash !== undefined ? { qrCodeHash } : {}),
        ...(qrCodeValue !== undefined ? { qrCodeValue } : {}),
        ...(dto.minimumGpsAccuracyMeters !== undefined
          ? { minimumGpsAccuracyMeters: dto.minimumGpsAccuracyMeters }
          : {}),
        ...(dto.requiresPhoto !== undefined
          ? { requiresPhoto: dto.requiresPhoto }
          : {}),
        ...(dto.requiresNote !== undefined
          ? { requiresNote: dto.requiresNote }
          : {}),
        ...(dto.instructions !== undefined
          ? { instructions: trimOrUndefined(dto.instructions) ?? null }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'PatrolCheckpoint',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { fields: Object.keys(dto) },
    });

    return toPatrolCheckpointResponse(updated);
  }

  async reorder(
    user: RequestUser,
    routeId: string,
    dto: ReorderPatrolCheckpointsDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    await this.assertRouteEditable(organisationId, routeId);

    const active = await this.prisma.patrolCheckpoint.findMany({
      where: {
        organisationId,
        patrolRouteId: routeId,
        deletedAt: null,
        active: true,
      },
      orderBy: { sequence: 'asc' },
    });

    if (dto.checkpoints.length !== active.length) {
      throw new AppException(
        'Reorder must include every active checkpoint on the route',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_ROUTE_CHECKPOINTS_INVALID,
      );
    }

    const activeIds = new Set(active.map((c) => c.id));
    const sequences = dto.checkpoints.map((c) => c.sequence);
    if (new Set(sequences).size !== sequences.length) {
      throw new AppException(
        'Duplicate sequences in reorder request',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_CHECKPOINT_SEQUENCE_CONFLICT,
      );
    }
    for (let i = 1; i <= sequences.length; i += 1) {
      if (!sequences.includes(i)) {
        throw new AppException(
          'Checkpoint sequences must be contiguous starting at 1',
          HttpStatus.CONFLICT,
          ErrorCode.PATROL_ROUTE_CHECKPOINTS_INVALID,
        );
      }
    }
    for (const item of dto.checkpoints) {
      if (!activeIds.has(item.checkpointId)) {
        throw new AppException(
          'Reorder includes a checkpoint that does not belong to this route',
          HttpStatus.CONFLICT,
          ErrorCode.PATROL_CHECKPOINT_NOT_FOUND,
        );
      }
    }

    const previous = active.map((c) => ({ id: c.id, sequence: c.sequence }));

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < dto.checkpoints.length; i += 1) {
        await tx.patrolCheckpoint.update({
          where: { id: dto.checkpoints[i].checkpointId },
          data: { sequence: -(i + 1) },
        });
      }
      for (const item of dto.checkpoints) {
        await tx.patrolCheckpoint.update({
          where: { id: item.checkpointId },
          data: { sequence: item.sequence },
        });
      }
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'PatrolCheckpoint',
      entityId: routeId,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        reorder: true,
        previous,
        next: dto.checkpoints.map((c) => ({
          checkpointId: c.checkpointId,
          sequence: c.sequence,
        })),
      },
    });

    return this.listByRoute(user, routeId);
  }

  async archive(user: RequestUser, id: string, ctx: ServiceRequestContext) {
    const organisationId = requireOrganisationId(user);
    const existing = await this.findCheckpointOrThrow(organisationId, id);
    if (existing.deletedAt) {
      return;
    }
    await this.assertRouteEditable(organisationId, existing.patrolRouteId);
    await this.assertNoActiveAssignmentsUsingCheckpoint(
      organisationId,
      existing.id,
    );

    await this.prisma.patrolCheckpoint.update({
      where: { id: existing.id },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    });

    await this.auditService.record({
      organisationId,
      actorUserId: user.id,
      action: AuditAction.DELETE,
      entityType: 'PatrolCheckpoint',
      entityId: existing.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { softArchive: true },
    });
  }

  private prepareCheckpointInput(dto: CreatePatrolCheckpointDto) {
    this.geofenceService.validateCoordinates(dto.latitude, dto.longitude);
    this.assertRadius(dto.allowedRadiusMeters);

    if (
      dto.verificationMethod ===
      CheckpointVerificationMethod.MANUAL_SUPERVISOR_OVERRIDE
    ) {
      throw new AppException(
        'MANUAL_SUPERVISOR_OVERRIDE cannot be configured on checkpoints',
        HttpStatus.BAD_REQUEST,
        ErrorCode.PATROL_VISIT_VERIFICATION_METHOD_INVALID,
      );
    }

    const qrTrimmed = trimOrUndefined(dto.qrCodeValue);
    const needsQr =
      dto.verificationMethod === CheckpointVerificationMethod.QR_CODE ||
      dto.verificationMethod === CheckpointVerificationMethod.GPS_AND_QR;

    if (needsQr && !qrTrimmed) {
      throw new AppException(
        'QR checkpoints require a QR value',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_CHECKPOINT_QR_REQUIRED,
      );
    }

    const qrCodeHash = qrTrimmed ? hashQrCode(qrTrimmed) : null;

    return {
      name: normalizePersonName(dto.name),
      description: trimOrUndefined(dto.description) ?? null,
      sequence: dto.sequence,
      latitude: new Prisma.Decimal(dto.latitude),
      longitude: new Prisma.Decimal(dto.longitude),
      allowedRadiusMeters: dto.allowedRadiusMeters,
      verificationMethod: dto.verificationMethod,
      qrCodeValue: needsQr ? (qrTrimmed ?? null) : null,
      qrCodeHash: needsQr ? qrCodeHash : null,
      minimumGpsAccuracyMeters: dto.minimumGpsAccuracyMeters ?? null,
      requiresPhoto: dto.requiresPhoto ?? false,
      requiresNote: dto.requiresNote ?? false,
      instructions: trimOrUndefined(dto.instructions) ?? null,
      active: true,
    };
  }

  private assertRadius(meters: number): void {
    const max =
      this.configService.get<number>('patrol.maxCheckpointRadiusMeters') ??
      1000;
    if (meters < 1 || meters > max) {
      throw new AppException(
        `Checkpoint radius must be between 1 and ${max} meters`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.PATROL_CHECKPOINT_RADIUS_INVALID,
      );
    }
  }

  private assertQrRequirement(
    method: CheckpointVerificationMethod,
    hash: string | null,
  ): void {
    if (
      (method === CheckpointVerificationMethod.QR_CODE ||
        method === CheckpointVerificationMethod.GPS_AND_QR) &&
      !hash
    ) {
      throw new AppException(
        'QR checkpoints require a QR value',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_CHECKPOINT_QR_REQUIRED,
      );
    }
  }

  private async assertRouteReadable(
    organisationId: string,
    routeId: string,
  ): Promise<void> {
    const route = await this.prisma.patrolRoute.findFirst({
      where: { id: routeId, organisationId, deletedAt: null },
      select: { id: true },
    });
    if (!route) {
      tenantNotFound(ErrorCode.PATROL_ROUTE_NOT_FOUND);
    }
  }

  private async assertRouteEditable(
    organisationId: string,
    routeId: string,
  ): Promise<void> {
    const route = await this.prisma.patrolRoute.findFirst({
      where: { id: routeId, organisationId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!route) {
      tenantNotFound(ErrorCode.PATROL_ROUTE_NOT_FOUND);
    }
    if (route.status === PatrolRouteStatus.ARCHIVED) {
      throw new AppException(
        'Archived routes cannot be edited',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_ROUTE_STATUS_INVALID,
      );
    }
  }

  private async findCheckpointOrThrow(organisationId: string, id: string) {
    const checkpoint = await this.prisma.patrolCheckpoint.findFirst({
      where: { id, organisationId, deletedAt: null },
    });
    if (!checkpoint) {
      tenantNotFound(ErrorCode.PATROL_CHECKPOINT_NOT_FOUND);
    }
    return checkpoint;
  }

  private async assertSequenceAvailable(
    organisationId: string,
    routeId: string,
    sequence: number,
    excludeId?: string,
  ): Promise<void> {
    const conflict = await this.prisma.patrolCheckpoint.findFirst({
      where: {
        organisationId,
        patrolRouteId: routeId,
        sequence,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (conflict) {
      throw new AppException(
        'Checkpoint sequence already in use on this route',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_CHECKPOINT_SEQUENCE_CONFLICT,
      );
    }
  }

  private async assertQrHashAvailable(
    organisationId: string,
    qrCodeHash: string,
    excludeId?: string,
  ): Promise<void> {
    const conflict = await this.prisma.patrolCheckpoint.findFirst({
      where: {
        organisationId,
        qrCodeHash,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (conflict) {
      throw new AppException(
        'QR code is already assigned to another checkpoint',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_CHECKPOINT_QR_CONFLICT,
      );
    }
  }

  private async assertNoActiveAssignmentsUsingCheckpoint(
    organisationId: string,
    checkpointId: string,
  ): Promise<void> {
    const inUse = await this.prisma.patrolAssignmentCheckpoint.findFirst({
      where: {
        organisationId,
        sourceCheckpointId: checkpointId,
        patrolAssignment: {
          status: {
            in: [
              PatrolAssignmentStatus.NOT_STARTED,
              PatrolAssignmentStatus.IN_PROGRESS,
              PatrolAssignmentStatus.REQUIRES_REVIEW,
            ],
          },
        },
      },
      select: { id: true },
    });
    if (inUse) {
      throw new AppException(
        'Checkpoint is referenced by an active patrol assignment',
        HttpStatus.CONFLICT,
        ErrorCode.PATROL_CHECKPOINT_IN_USE,
      );
    }
  }
}
