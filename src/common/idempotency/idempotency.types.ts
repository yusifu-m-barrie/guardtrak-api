import type { SyncOperationStatus } from '../../../generated/prisma/client';

/** Logical idempotency status exposed to callers (maps from Prisma SyncOperationStatus). */
export type IdempotencyStatus =
  'started' | 'completed' | 'failed' | 'conflict' | 'expired';

export interface IdempotencyRecord {
  key: string;
  organisationId?: string;
  userId?: string;
  operation: string;
  requestHash: string;
  status: IdempotencyStatus;
  httpStatus?: number;
  responseBody?: unknown;
  resourceType?: string;
  resourceId?: string;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface IdempotencyLookupResult {
  found: boolean;
  record?: IdempotencyRecord;
  replay?: boolean;
}

export interface IdempotencyBeginInput {
  key: string;
  organisationId?: string;
  userId: string;
  operation: string;
  requestHash: string;
  ttlSeconds: number;
}

const SYNC_TO_LOGICAL_STATUS: Record<SyncOperationStatus, IdempotencyStatus> = {
  RECEIVED: 'started',
  PROCESSING: 'started',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CONFLICT: 'conflict',
  EXPIRED: 'expired',
};

export function toLogicalIdempotencyStatus(
  status: SyncOperationStatus,
): IdempotencyStatus {
  return SYNC_TO_LOGICAL_STATUS[status];
}

export function isTerminalIdempotencyStatus(
  status: IdempotencyStatus,
): boolean {
  return (
    status === 'completed' ||
    status === 'failed' ||
    status === 'conflict' ||
    status === 'expired'
  );
}
