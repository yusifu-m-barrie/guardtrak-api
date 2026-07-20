import type {
  IdempotencyBeginInput,
  IdempotencyLookupResult,
  IdempotencyRecord,
} from './idempotency.types';

/**
 * Persistence port for idempotent mutations.
 */
export interface IdempotencyStore {
  findByKey(userId: string, key: string): Promise<IdempotencyRecord | null>;
  begin(input: IdempotencyBeginInput): Promise<IdempotencyLookupResult>;
  complete(
    userId: string,
    key: string,
    responseStatusCode: number,
    responseBody: unknown,
  ): Promise<void>;
  fail(userId: string, key: string, errorMessage: string): Promise<void>;
}

export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE');
