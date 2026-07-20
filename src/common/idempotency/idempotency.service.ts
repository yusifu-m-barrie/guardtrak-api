import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';
import { AppException } from '../exceptions/app.exception';
import {
  IDEMPOTENCY_STORE,
  type IdempotencyStore,
} from './idempotency.interface';
import type {
  IdempotencyBeginInput,
  IdempotencyLookupResult,
} from './idempotency.types';
import { isTerminalIdempotencyStatus } from './idempotency.types';

/**
 * Idempotency orchestration for mutating API operations.
 * Proceeds without persistence when no store is registered (backward compatible).
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly store?: IdempotencyStore,
  ) {}

  async begin(input: IdempotencyBeginInput): Promise<IdempotencyLookupResult> {
    if (!this.store) {
      this.logger.warn(
        'Idempotency store is not configured; operation proceeds without persistence',
      );
      return { found: false };
    }

    const result = await this.store.begin(input);

    if (result.replay) {
      return result;
    }

    if (result.found && result.record) {
      if (result.record.status === 'started') {
        throw new AppException(
          'A request with this Idempotency-Key is already in progress',
          HttpStatus.CONFLICT,
          ErrorCode.IDEMPOTENCY_OPERATION_IN_PROGRESS,
        );
      }

      if (
        isTerminalIdempotencyStatus(result.record.status) &&
        result.record.requestHash !== input.requestHash
      ) {
        throw new AppException(
          'Idempotency-Key was reused with a different payload',
          HttpStatus.CONFLICT,
          ErrorCode.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD,
        );
      }
    }

    return result;
  }

  async complete(
    userId: string,
    key: string,
    responseStatusCode: number,
    responseBody: unknown,
  ): Promise<void> {
    if (!this.store) {
      this.logger.warn(
        'Idempotency store is not configured; completion is not persisted',
      );
      return;
    }

    await this.store.complete(userId, key, responseStatusCode, responseBody);
  }

  async fail(userId: string, key: string, errorMessage: string): Promise<void> {
    if (!this.store) {
      this.logger.warn(
        'Idempotency store is not configured; failure is not persisted',
      );
      return;
    }

    await this.store.fail(userId, key, errorMessage);
  }
}
