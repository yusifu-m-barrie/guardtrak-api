import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import { redactHeaders } from '../utils/redact.util';
import { REQUEST_ID_HEADER } from '../constants/metadata-keys';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { requestId?: string }>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();

    const requestId =
      request.requestId ??
      (typeof request.headers[REQUEST_ID_HEADER] === 'string'
        ? request.headers[REQUEST_ID_HEADER]
        : 'unknown');

    const method = request.method;
    const route = request.originalUrl ?? request.url;
    const safeHeaders = redactHeaders(request.headers);

    this.logger.log(
      `[${requestId}] --> ${method} ${route} headers=${JSON.stringify(safeHeaders)}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startedAt;
          this.logger.log(
            `[${requestId}] <-- ${method} ${route} ${response.statusCode} ${durationMs}ms`,
          );
        },
        error: () => {
          const durationMs = Date.now() - startedAt;
          this.logger.warn(
            `[${requestId}] <-- ${method} ${route} error ${durationMs}ms`,
          );
        },
      }),
    );
  }
}
