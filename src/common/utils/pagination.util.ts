import { HttpStatus } from '@nestjs/common';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '../constants/metadata-keys';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../constants/error-codes';

export function normalisePagination(
  page?: number,
  limit?: number,
): { page: number; limit: number; skip: number } {
  const safePage =
    page && Number.isFinite(page) && page > 0 ? Math.floor(page) : DEFAULT_PAGE;
  const rawLimit =
    limit && Number.isFinite(limit) && limit > 0
      ? Math.floor(limit)
      : DEFAULT_PAGE_LIMIT;
  const safeLimit = Math.min(rawLimit, MAX_PAGE_LIMIT);

  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
}

/**
 * Ensures sortBy is in an allow-list before use in queries.
 * Feature modules must supply their own whitelist.
 */
export function assertAllowedSortField(
  sortBy: string | undefined,
  allowedFields: readonly string[],
  defaultField?: string,
): string | undefined {
  if (!sortBy) {
    return defaultField;
  }
  if (!allowedFields.includes(sortBy)) {
    throw new AppException(
      `Unsupported sort field: ${sortBy}`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_ERROR,
    );
  }
  return sortBy;
}
