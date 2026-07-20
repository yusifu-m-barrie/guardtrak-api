import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SyncOperationStatus,
  type IdempotencyRecord as PrismaIdempotencyRecord,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { IdempotencyStore } from './idempotency.interface';
import type {
  IdempotencyBeginInput,
  IdempotencyLookupResult,
  IdempotencyRecord,
} from './idempotency.types';
import { toLogicalIdempotencyStatus } from './idempotency.types';

const PROCESSING_LOCK_MS = 30_000;

@Injectable()
export class PrismaIdempotencyStore implements IdempotencyStore {
  constructor(private readonly prisma: PrismaService) {}

  async findByKey(
    userId: string,
    key: string,
  ): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.idempotencyRecord.findUnique({
      where: {
        userId_key: {
          userId,
          key,
        },
      },
    });

    return row ? mapRow(row) : null;
  }

  async begin(input: IdempotencyBeginInput): Promise<IdempotencyLookupResult> {
    const now = new Date();
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        userId_key: {
          userId: input.userId,
          key: input.key,
        },
      },
    });

    if (existing) {
      const inProgress =
        existing.status === SyncOperationStatus.PROCESSING &&
        existing.lockedUntil !== null &&
        existing.lockedUntil > now;

      if (inProgress) {
        return {
          found: true,
          record: mapRow(existing),
        };
      }

      if (existing.status === SyncOperationStatus.COMPLETED) {
        if (existing.requestHash === input.requestHash) {
          return {
            found: true,
            replay: true,
            record: mapRow(existing),
          };
        }

        return {
          found: true,
          record: mapRow(existing),
        };
      }

      if (
        (existing.status === SyncOperationStatus.FAILED ||
          existing.status === SyncOperationStatus.CONFLICT) &&
        existing.requestHash !== input.requestHash
      ) {
        return {
          found: true,
          record: mapRow(existing),
        };
      }

      const updated = await this.prisma.idempotencyRecord.update({
        where: { id: existing.id },
        data: buildProcessingData(input, now),
      });

      return {
        found: false,
        record: mapRow(updated),
      };
    }

    try {
      const created = await this.prisma.idempotencyRecord.create({
        data: {
          organisationId: input.organisationId,
          userId: input.userId,
          key: input.key,
          operation: input.operation,
          requestHash: input.requestHash,
          status: SyncOperationStatus.PROCESSING,
          lockedUntil: new Date(now.getTime() + PROCESSING_LOCK_MS),
          expiresAt: new Date(now.getTime() + input.ttlSeconds * 1000),
        },
      });

      return {
        found: false,
        record: mapRow(created),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.begin(input);
      }

      throw error;
    }
  }

  async complete(
    userId: string,
    key: string,
    responseStatusCode: number,
    responseBody: unknown,
  ): Promise<void> {
    await this.prisma.idempotencyRecord.update({
      where: {
        userId_key: {
          userId,
          key,
        },
      },
      data: {
        status: SyncOperationStatus.COMPLETED,
        httpStatus: responseStatusCode,
        responseBody: toJsonValue(responseBody),
        lockedUntil: null,
      },
    });
  }

  async fail(userId: string, key: string, errorMessage: string): Promise<void> {
    await this.prisma.idempotencyRecord.update({
      where: {
        userId_key: {
          userId,
          key,
        },
      },
      data: {
        status: SyncOperationStatus.FAILED,
        lockedUntil: null,
        responseBody: {
          error: errorMessage,
        },
      },
    });
  }
}

function buildProcessingData(
  input: IdempotencyBeginInput,
  now: Date,
): Prisma.IdempotencyRecordUpdateInput {
  return {
    operation: input.operation,
    requestHash: input.requestHash,
    status: SyncOperationStatus.PROCESSING,
    lockedUntil: new Date(now.getTime() + PROCESSING_LOCK_MS),
    expiresAt: new Date(now.getTime() + input.ttlSeconds * 1000),
    httpStatus: null,
    responseBody: Prisma.JsonNull,
  };
}

function mapRow(row: PrismaIdempotencyRecord): IdempotencyRecord {
  return {
    key: row.key,
    organisationId: row.organisationId ?? undefined,
    userId: row.userId ?? undefined,
    operation: row.operation,
    requestHash: row.requestHash,
    status: toLogicalIdempotencyStatus(row.status),
    httpStatus: row.httpStatus ?? undefined,
    responseBody: row.responseBody ?? undefined,
    resourceType: row.resourceType ?? undefined,
    resourceId: row.resourceId ?? undefined,
    lockedUntil: row.lockedUntil ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt,
  };
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === undefined) {
    return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  }

  return value as Prisma.InputJsonValue;
}
