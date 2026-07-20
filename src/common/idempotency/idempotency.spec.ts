import { HttpStatus } from '@nestjs/common';
import { SyncOperationStatus } from '../../../generated/prisma/client';
import { ErrorCode } from '../constants/error-codes';
import { AppException } from '../exceptions/app.exception';
import { IdempotencyService } from './idempotency.service';
import type { IdempotencyStore } from './idempotency.interface';
import { PrismaIdempotencyStore } from './prisma-idempotency.store';
import type { PrismaService } from '../../database/prisma/prisma.service';

describe('IdempotencyService', () => {
  const beginInput = {
    key: 'key-1',
    userId: 'user-1',
    organisationId: 'org-1',
    operation: 'clock-in',
    requestHash: 'hash-a',
    ttlSeconds: 3600,
  };

  it('throws when an operation is already in progress', async () => {
    const store: IdempotencyStore = {
      findByKey: jest.fn(),
      begin: jest.fn().mockResolvedValue({
        found: true,
        record: {
          key: beginInput.key,
          operation: beginInput.operation,
          requestHash: beginInput.requestHash,
          status: 'started',
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(),
          lockedUntil: new Date(Date.now() + 30_000),
        },
      }),
      complete: jest.fn(),
      fail: jest.fn(),
    };

    const service = new IdempotencyService(store);

    await expect(service.begin(beginInput)).rejects.toBeInstanceOf(
      AppException,
    );

    try {
      await service.begin(beginInput);
    } catch (error) {
      expect((error as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
      expect((error as AppException).getResponse()).toMatchObject({
        code: ErrorCode.IDEMPOTENCY_OPERATION_IN_PROGRESS,
      });
    }
  });

  it('throws when a completed key is reused with a different payload hash', async () => {
    const store: IdempotencyStore = {
      findByKey: jest.fn(),
      begin: jest.fn().mockResolvedValue({
        found: true,
        record: {
          key: beginInput.key,
          operation: beginInput.operation,
          requestHash: 'hash-b',
          status: 'completed',
          httpStatus: 201,
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(),
        },
      }),
      complete: jest.fn(),
      fail: jest.fn(),
    };

    const service = new IdempotencyService(store);

    await expect(service.begin(beginInput)).rejects.toBeInstanceOf(
      AppException,
    );

    try {
      await service.begin(beginInput);
    } catch (error) {
      expect((error as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
      expect((error as AppException).getResponse()).toMatchObject({
        code: ErrorCode.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD,
      });
    }
  });

  it('proceeds without persistence when no store is registered', async () => {
    const service = new IdempotencyService(undefined);

    await expect(service.begin(beginInput)).resolves.toEqual({ found: false });
    await expect(
      service.complete(beginInput.userId, beginInput.key, 200, { ok: true }),
    ).resolves.toBeUndefined();
    await expect(
      service.fail(beginInput.userId, beginInput.key, 'boom'),
    ).resolves.toBeUndefined();
  });

  it('returns replay results without throwing', async () => {
    const replayResult = {
      found: true,
      replay: true,
      record: {
        key: beginInput.key,
        operation: beginInput.operation,
        requestHash: beginInput.requestHash,
        status: 'completed' as const,
        httpStatus: 200,
        responseBody: { ok: true },
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      },
    };

    const store: IdempotencyStore = {
      findByKey: jest.fn(),
      begin: jest.fn().mockResolvedValue(replayResult),
      complete: jest.fn(),
      fail: jest.fn(),
    };

    const service = new IdempotencyService(store);

    await expect(service.begin(beginInput)).resolves.toEqual(replayResult);
  });
});

describe('PrismaIdempotencyStore', () => {
  const beginInput = {
    key: 'key-1',
    userId: 'user-1',
    organisationId: 'org-1',
    operation: 'clock-in',
    requestHash: 'hash-a',
    ttlSeconds: 3600,
  };

  it('returns replay when a completed record matches the request hash', async () => {
    const existing = {
      id: 'record-1',
      organisationId: beginInput.organisationId,
      userId: beginInput.userId,
      key: beginInput.key,
      operation: beginInput.operation,
      requestHash: beginInput.requestHash,
      status: SyncOperationStatus.COMPLETED,
      httpStatus: 200,
      responseBody: { ok: true },
      resourceType: null,
      resourceId: null,
      lockedUntil: null,
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const create = jest.fn();
    const update = jest.fn();
    const prisma = {
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(existing),
        create,
        update,
      },
    } as unknown as PrismaService;

    const store = new PrismaIdempotencyStore(prisma);
    const result = await store.begin(beginInput);

    expect(result.replay).toBe(true);
    expect(result.record?.httpStatus).toBe(200);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('returns an in-progress record when the lock has not expired', async () => {
    const existing = {
      id: 'record-1',
      organisationId: beginInput.organisationId,
      userId: beginInput.userId,
      key: beginInput.key,
      operation: beginInput.operation,
      requestHash: beginInput.requestHash,
      status: SyncOperationStatus.PROCESSING,
      httpStatus: null,
      responseBody: null,
      resourceType: null,
      resourceId: null,
      lockedUntil: new Date(Date.now() + 30_000),
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const create = jest.fn();
    const update = jest.fn();
    const prisma = {
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(existing),
        create,
        update,
      },
    } as unknown as PrismaService;

    const store = new PrismaIdempotencyStore(prisma);
    const result = await store.begin(beginInput);

    expect(result.found).toBe(true);
    expect(result.replay).toBeUndefined();
    expect(result.record?.status).toBe('started');
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('returns a completed record when the request hash differs', async () => {
    const existing = {
      id: 'record-1',
      organisationId: beginInput.organisationId,
      userId: beginInput.userId,
      key: beginInput.key,
      operation: beginInput.operation,
      requestHash: 'hash-b',
      status: SyncOperationStatus.COMPLETED,
      httpStatus: 200,
      responseBody: { ok: true },
      resourceType: null,
      resourceId: null,
      lockedUntil: null,
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const create = jest.fn();
    const update = jest.fn();
    const prisma = {
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(existing),
        create,
        update,
      },
    } as unknown as PrismaService;

    const store = new PrismaIdempotencyStore(prisma);
    const result = await store.begin(beginInput);

    expect(result.replay).toBeUndefined();
    expect(result.found).toBe(true);
    expect(result.record?.requestHash).toBe('hash-b');
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
