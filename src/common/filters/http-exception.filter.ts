import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCode } from '../constants/error-codes';
import { REQUEST_ID_HEADER } from '../constants/metadata-keys';
import type { ApiErrorResponse } from '../types/api-response.type';
import { formatNestValidationMessages } from '../utils/validation-errors.util';
import { mapPrismaError } from './prisma-error.mapper';
import { generateRequestId } from '../utils/request-id.util';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const requestId =
      request.requestId ??
      (typeof request.headers[REQUEST_ID_HEADER] === 'string'
        ? request.headers[REQUEST_ID_HEADER]
        : generateRequestId());

    const isProduction = process.env.NODE_ENV === 'production';
    const prismaMapped = mapPrismaError(exception);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let code: string = ErrorCode.INTERNAL_ERROR;
    let errors: ApiErrorResponse['errors'] = [];

    if (prismaMapped) {
      status = prismaMapped.status;
      message = prismaMapped.message;
      code = prismaMapped.code;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        code = this.statusToCode(status);
      } else if (typeof exceptionResponse === 'object' && exceptionResponse) {
        const body = exceptionResponse as Record<string, unknown>;
        message =
          typeof body.message === 'string'
            ? body.message
            : Array.isArray(body.message)
              ? 'Validation failed'
              : message;
        code =
          typeof body.code === 'string' ? body.code : this.statusToCode(status);

        if (Array.isArray(body.message)) {
          errors = formatNestValidationMessages(
            body.message.map((item) => String(item)),
          );
          code = ErrorCode.VALIDATION_ERROR;
          message = 'Validation failed';
        } else if (Array.isArray(body.errors)) {
          errors = body.errors as ApiErrorResponse['errors'];
        }
      }
    }

    if (!isProduction) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      const prismaCode =
        exception &&
        typeof exception === 'object' &&
        'code' in exception &&
        typeof exception.code === 'string'
          ? (exception as { code: string }).code
          : '';
      const detail = exception instanceof Error ? exception.message : undefined;
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} -> ${status} ${code}${
          prismaCode ? ` prisma=${prismaCode}` : ''
        }${detail ? ` — ${detail}` : ''}`,
      );
    }

    const payload: ApiErrorResponse = {
      success: false,
      message,
      code,
      errors,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(payload);
  }

  private statusToCode(status: number): string {
    const mapping: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: ErrorCode.BAD_REQUEST,
      [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
      [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
      [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
      [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
      [HttpStatus.LOCKED]: ErrorCode.AUTH_ACCOUNT_LOCKED,
    };

    return mapping[status] ?? ErrorCode.INTERNAL_ERROR;
  }
}
