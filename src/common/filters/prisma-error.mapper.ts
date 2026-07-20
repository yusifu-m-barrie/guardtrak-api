import { ErrorCode } from '../constants/error-codes';
import { HttpStatus } from '@nestjs/common';

export interface MappedPrismaError {
  status: HttpStatus;
  code: ErrorCode;
  message: string;
}

/**
 * Placeholder Prisma error mapper.
 * Expanded when the schema and Prisma client error shapes are fully wired.
 */
export function mapPrismaError(error: unknown): MappedPrismaError | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const code =
    'code' in error && typeof error.code === 'string' ? error.code : undefined;

  if (!code) {
    return null;
  }

  switch (code) {
    case 'P2002':
      return {
        status: HttpStatus.CONFLICT,
        code: ErrorCode.CONFLICT,
        message: 'A record with this value already exists',
      };
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        code: ErrorCode.NOT_FOUND,
        message: 'Record not found',
      };
    case 'P2003':
      return {
        status: HttpStatus.BAD_REQUEST,
        code: ErrorCode.BAD_REQUEST,
        message: 'Related record constraint failed',
      };
    default:
      if (code.startsWith('P')) {
        return {
          status: HttpStatus.BAD_REQUEST,
          code: ErrorCode.DATABASE_ERROR,
          message: 'A database error occurred',
        };
      }
      return null;
  }
}
