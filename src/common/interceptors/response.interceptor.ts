import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { Request, Response } from 'express';
import type { ApiSuccessResponse } from '../types/api-response.type';
import { generateRequestId } from '../utils/request-id.util';
import { REQUEST_ID_HEADER } from '../constants/metadata-keys';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T> | T
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T> | T> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { requestId?: string }>();
    const response = http.getResponse<Response>();

    const requestId =
      request.requestId ??
      (typeof request.headers[REQUEST_ID_HEADER] === 'string'
        ? request.headers[REQUEST_ID_HEADER]
        : generateRequestId());

    return next.handle().pipe(
      map((data) => {
        if (response.statusCode === 204) {
          return data;
        }

        if (this.isAlreadyEnveloped(data)) {
          return data;
        }

        const meta =
          data !== null &&
          typeof data === 'object' &&
          'meta' in data &&
          'data' in data
            ? ((data as { meta: Record<string, unknown> }).meta ?? {})
            : {};

        const payload =
          data !== null &&
          typeof data === 'object' &&
          'data' in data &&
          'meta' in data
            ? (data as { data: T }).data
            : data;

        return {
          success: true as const,
          data: payload,
          meta,
          requestId,
        };
      }),
    );
  }

  private isAlreadyEnveloped(data: unknown): boolean {
    return (
      data !== null &&
      typeof data === 'object' &&
      'success' in data &&
      'requestId' in data
    );
  }
}
