import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  SyncOperationStatus,
  SupportRequestCategory,
  SupportRequestPriority,
} from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { hashRequestPayload } from '../../common/idempotency/request-hash.util';
import type { RequestUser } from '../../common/types/request-user.type';
import { requireOrganisationId } from '../../common/tenant/tenant.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { ServiceRequestContext } from '../clients/clients.types';
import { EmergenciesService } from '../emergencies/emergencies.service';
import type { CreateSosDto } from '../emergencies/dto/create-sos.dto';
import { IncidentsService } from '../incidents/incidents.service';
import type { CreateIncidentDto } from '../incidents/dto/create-incident.dto';
import { SupportService } from '../support/support.service';
import type { CreateSupportRequestDto } from '../support/dto/create-support-request.dto';
import type { SyncBatchDto, SyncOperationDto } from './dto/sync-batch.dto';
import { detectSyncConflict } from './sync-conflict.util';

export interface SyncOpResult {
  operationId: string;
  status: 'completed' | 'replayed' | 'conflict' | 'failed';
  resourceId?: string;
  error?: string;
}

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly idempotencyService: IdempotencyService,
    private readonly incidentsService: IncidentsService,
    private readonly emergenciesService: EmergenciesService,
    private readonly supportService: SupportService,
  ) {}

  async processBatch(
    user: RequestUser,
    dto: SyncBatchDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    const results: SyncOpResult[] = [];
    const conflicts: Array<{
      operationId: string;
      reasonCode: string;
      message: string;
    }> = [];

    for (const op of dto.operations) {
      const result = await this.processOne(user, organisationId, op, ctx);
      results.push(result);
      if (result.status === 'conflict') {
        conflicts.push({
          operationId: result.operationId,
          reasonCode: 'SYNC_CONFLICT',
          message: result.error ?? 'Conflict',
        });
      }
    }

    return { results, conflicts };
  }

  private async processOne(
    user: RequestUser,
    organisationId: string,
    op: SyncOperationDto,
    ctx: ServiceRequestContext,
  ): Promise<SyncOpResult> {
    const existing = await this.prisma.syncOperation.findUnique({
      where: {
        userId_operationId: { userId: user.id, operationId: op.operationId },
      },
    });

    if (existing?.status === SyncOperationStatus.COMPLETED) {
      return {
        operationId: op.operationId,
        status: 'replayed',
        resourceId: undefined,
      };
    }

    const ttl =
      this.configService.get<number>('sync.idempotencyTtlSeconds') ?? 86_400;
    const requestHash = hashRequestPayload({
      entityType: op.entityType,
      operationType: op.operationType,
      payload: op.payload,
      localEntityId: op.localEntityId ?? null,
    });

    try {
      const begin = await this.idempotencyService.begin({
        key: `sync:${op.operationId}`,
        organisationId,
        userId: user.id,
        operation: `sync.${op.entityType}`,
        requestHash,
        ttlSeconds: ttl,
      });

      if (begin.replay && begin.record?.responseBody) {
        const body = begin.record.responseBody as {
          resourceId?: string;
        };
        return {
          operationId: op.operationId,
          status: 'replayed',
          resourceId: body.resourceId,
        };
      }

      const resourceId = await this.dispatch(user, op, ctx);
      const response = { resourceId };
      await this.idempotencyService.complete(
        user.id,
        `sync:${op.operationId}`,
        200,
        response,
      );
      await this.upsertSyncOp(
        organisationId,
        user.id,
        op,
        SyncOperationStatus.COMPLETED,
      );
      return {
        operationId: op.operationId,
        status: 'completed',
        resourceId,
      };
    } catch (error) {
      if (
        error instanceof AppException &&
        this.isIdempotencyPayloadConflict(error)
      ) {
        const detection = detectSyncConflict({
          operationId: op.operationId,
          entityType: op.entityType,
          localEntityId: op.localEntityId,
          existingServerEntityId: null,
          payloadChanged: true,
        });
        await this.prisma.syncConflict.create({
          data: {
            organisationId,
            userId: user.id,
            operationId: op.operationId,
            entityType: op.entityType,
            localEntityId: op.localEntityId ?? null,
            reasonCode: detection.reasonCode ?? 'IDEMPOTENT_PAYLOAD_MISMATCH',
            message: detection.message ?? error.message,
            localPayload: op.payload as Prisma.InputJsonValue,
          },
        });
        await this.upsertSyncOp(
          organisationId,
          user.id,
          op,
          SyncOperationStatus.CONFLICT,
          detection.message,
        );
        return {
          operationId: op.operationId,
          status: 'conflict',
          error: detection.message,
        };
      }
      const message =
        error instanceof Error ? error.message : 'sync operation failed';
      await this.idempotencyService.fail(
        user.id,
        `sync:${op.operationId}`,
        message,
      );
      await this.upsertSyncOp(
        organisationId,
        user.id,
        op,
        SyncOperationStatus.FAILED,
        message,
      );
      if (error instanceof AppException) {
        return {
          operationId: op.operationId,
          status: 'failed',
          error: message,
        };
      }
      throw error;
    }
  }

  private async dispatch(
    user: RequestUser,
    op: SyncOperationDto,
    ctx: ServiceRequestContext,
  ): Promise<string | undefined> {
    switch (op.entityType) {
      case 'incident.create': {
        const dto = this.asIncidentDto(op);
        const created = (await this.incidentsService.create(
          user,
          dto,
          ctx,
        )) as { id: string };
        return created.id;
      }
      case 'emergency.sos': {
        const dto = this.asSosDto(op);
        const created = (await this.emergenciesService.createSos(
          user,
          dto,
          ctx,
        )) as { id: string };
        return created.id;
      }
      case 'support.request': {
        const dto = this.asSupportDto(op);
        const created = (await this.supportService.createRequest(
          user,
          dto,
          ctx,
        )) as { id: string };
        return created.id;
      }
      case 'attendance.clock_in':
      case 'attendance.clock_out':
      case 'patrol.visit':
        throw new AppException(
          `${op.entityType} sync replay should use the dedicated endpoint with the same idempotencyKey; batch acknowledges receipt only`,
          HttpStatus.NOT_IMPLEMENTED,
          ErrorCode.SYNC_ENTITY_UNSUPPORTED,
        );
      default:
        throw new AppException(
          `Unsupported sync entityType: ${op.entityType}`,
          HttpStatus.BAD_REQUEST,
          ErrorCode.SYNC_ENTITY_UNSUPPORTED,
        );
    }
  }

  private asIncidentDto(op: SyncOperationDto): CreateIncidentDto {
    const p = op.payload;
    const siteId = this.stringField(p, 'siteId');
    const category = this.stringField(p, 'category');
    const severity = this.stringField(p, 'severity');
    const title = this.stringField(p, 'title');
    const description = this.stringField(p, 'description');
    const occurredAtDevice = this.stringField(p, 'occurredAtDevice');
    if (
      !siteId ||
      !category ||
      !severity ||
      !title ||
      !description ||
      !occurredAtDevice
    ) {
      throw new AppException(
        'Invalid incident.create payload',
        HttpStatus.BAD_REQUEST,
        ErrorCode.SYNC_PAYLOAD_INVALID,
      );
    }
    return {
      siteId,
      category: category as CreateIncidentDto['category'],
      severity: severity as CreateIncidentDto['severity'],
      title,
      description,
      occurredAtDevice,
      localIncidentId:
        op.localEntityId ?? this.optionalString(p, 'localIncidentId'),
      idempotencyKey: op.operationId,
    };
  }

  private asSosDto(op: SyncOperationDto): CreateSosDto {
    const p = op.payload;
    const deviceCreatedAt = this.stringField(p, 'deviceCreatedAt');
    const latitude = this.numberField(p, 'latitude');
    const longitude = this.numberField(p, 'longitude');
    if (!deviceCreatedAt || latitude == null || longitude == null) {
      throw new AppException(
        'Invalid emergency.sos payload',
        HttpStatus.BAD_REQUEST,
        ErrorCode.SYNC_PAYLOAD_INVALID,
      );
    }
    return {
      deviceCreatedAt,
      latitude,
      longitude,
      accuracyMeters: this.numberField(p, 'accuracyMeters') ?? undefined,
      siteId: this.optionalString(p, 'siteId'),
      localEmergencyId:
        op.localEntityId ?? this.optionalString(p, 'localEmergencyId'),
      idempotencyKey: op.operationId,
    };
  }

  private asSupportDto(op: SyncOperationDto): CreateSupportRequestDto {
    const p = op.payload;
    const subject = this.stringField(p, 'subject');
    const description = this.stringField(p, 'description');
    if (!subject || !description) {
      throw new AppException(
        'Invalid support.request payload',
        HttpStatus.BAD_REQUEST,
        ErrorCode.SYNC_PAYLOAD_INVALID,
      );
    }
    const category = this.optionalString(p, 'category');
    const priority = this.optionalString(p, 'priority');
    return {
      subject,
      description,
      ...(category ? { category: category as SupportRequestCategory } : {}),
      ...(priority ? { priority: priority as SupportRequestPriority } : {}),
    };
  }

  private stringField(
    payload: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = payload[key];
    return typeof value === 'string' ? value : null;
  }

  private optionalString(
    payload: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = this.stringField(payload, key);
    return value ?? undefined;
  }

  private numberField(
    payload: Record<string, unknown>,
    key: string,
  ): number | null {
    const value = payload[key];
    return typeof value === 'number' ? value : null;
  }

  private isIdempotencyPayloadConflict(error: AppException): boolean {
    const response = error.getResponse();
    if (
      typeof response === 'object' &&
      response !== null &&
      'code' in response
    ) {
      return (
        String((response as { code: string }).code) ===
        String(ErrorCode.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
      );
    }
    return false;
  }

  private async upsertSyncOp(
    organisationId: string,
    userId: string,
    op: SyncOperationDto,
    status: SyncOperationStatus,
    error?: string,
  ) {
    await this.prisma.syncOperation.upsert({
      where: {
        userId_operationId: { userId, operationId: op.operationId },
      },
      create: {
        organisationId,
        userId,
        operationId: op.operationId,
        operationType: op.operationType,
        entityType: op.entityType,
        status,
        attemptCount: 1,
        processedAt:
          status === SyncOperationStatus.COMPLETED ? new Date() : null,
        lastErrorMessage: error ?? null,
      },
      update: {
        status,
        attemptCount: { increment: 1 },
        processedAt:
          status === SyncOperationStatus.COMPLETED ? new Date() : undefined,
        lastErrorMessage: error ?? null,
      },
    });
  }
}
