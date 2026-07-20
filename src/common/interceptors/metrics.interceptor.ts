import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const enabled =
      this.configService.get<boolean>('observability.metricsEnabled') === true;

    if (!enabled) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();
    const method = request.method;
    const routePath =
      typeof request.route === 'object' &&
      request.route !== null &&
      'path' in request.route &&
      typeof (request.route as { path?: unknown }).path === 'string'
        ? (request.route as { path: string }).path
        : undefined;
    const route = routePath ?? request.path ?? request.url;

    return next.handle().pipe(
      tap({
        next: () => {
          this.metricsService.recordHttp(
            method,
            route,
            response.statusCode,
            Date.now() - startedAt,
          );
        },
        error: () => {
          const status =
            typeof response.statusCode === 'number' &&
            response.statusCode >= 400
              ? response.statusCode
              : 500;
          this.metricsService.recordHttp(
            method,
            route,
            status,
            Date.now() - startedAt,
          );
        },
      }),
    );
  }
}
