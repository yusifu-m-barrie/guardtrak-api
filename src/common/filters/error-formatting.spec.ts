import { formatNestValidationMessages } from '../utils/validation-errors.util';
import { mapPrismaError } from './prisma-error.mapper';
import { ErrorCode } from '../constants/error-codes';
import { HttpStatus } from '@nestjs/common';

describe('error formatting', () => {
  it('formats nest validation messages', () => {
    const details = formatNestValidationMessages([
      'page must be an integer number',
      'limit must not be greater than 100',
    ]);

    expect(details).toHaveLength(2);
    expect(details[0].code).toBe('VALIDATION_ERROR');
  });

  it('maps known prisma codes', () => {
    const mapped = mapPrismaError({ code: 'P2002' });
    expect(mapped).toEqual({
      status: HttpStatus.CONFLICT,
      code: ErrorCode.CONFLICT,
      message: 'A record with this value already exists',
    });
  });

  it('returns null for non-prisma errors', () => {
    expect(mapPrismaError(new Error('boom'))).toBeNull();
  });
});
