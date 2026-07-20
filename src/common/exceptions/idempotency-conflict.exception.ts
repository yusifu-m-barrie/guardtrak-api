import { ConflictException } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';

export class IdempotencyConflictException extends ConflictException {
  constructor(message = 'Idempotency key conflict') {
    super({
      message,
      code: ErrorCode.IDEMPOTENCY_CONFLICT,
      errors: [],
    });
  }
}
