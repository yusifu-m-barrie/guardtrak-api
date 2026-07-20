import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';

export class AppException extends HttpException {
  constructor(
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    code: ErrorCode = ErrorCode.BAD_REQUEST,
    errors: Array<{ field?: string; message: string; code?: string }> = [],
  ) {
    super(
      {
        message,
        code,
        errors,
      },
      status,
    );
  }
}
