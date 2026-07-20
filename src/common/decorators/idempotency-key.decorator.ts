import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IDEMPOTENCY_KEY_HEADER } from '../constants/metadata-keys';
import type { Request } from 'express';

/**
 * Reads the Idempotency-Key request header.
 * Persistence is deferred — see docs/idempotency.md.
 */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const value = request.headers[IDEMPOTENCY_KEY_HEADER];

    if (Array.isArray(value)) {
      return value[0];
    }

    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined;
  },
);
