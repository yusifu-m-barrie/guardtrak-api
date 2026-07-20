import { HttpStatus } from '@nestjs/common';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../constants/error-codes';
import type { RequestUser } from '../types/request-user.type';

/** Require organisation tenancy for ordinary organisation routes. */
export function requireOrganisationId(user: RequestUser): string {
  if (!user.organisationId) {
    throw new AppException(
      'Organisation context is required',
      HttpStatus.FORBIDDEN,
      ErrorCode.AUTH_ORGANISATION_REQUIRED,
    );
  }
  return user.organisationId;
}

export function tenantNotFound(
  code: ErrorCode = ErrorCode.TENANT_RESOURCE_NOT_FOUND,
): never {
  throw new AppException('Resource not found', HttpStatus.NOT_FOUND, code);
}

export function assertSameOrganisation(
  userOrgId: string,
  entityOrgId: string | null | undefined,
  code: ErrorCode = ErrorCode.TENANT_RESOURCE_NOT_FOUND,
): void {
  if (!entityOrgId || entityOrgId !== userOrgId) {
    tenantNotFound(code);
  }
}

export function userHasPermission(
  user: RequestUser,
  permission: string,
): boolean {
  return user.permissions.includes(permission);
}

export function assertPermission(user: RequestUser, permission: string): void {
  if (!userHasPermission(user, permission)) {
    throw new AppException(
      'Insufficient permissions',
      HttpStatus.FORBIDDEN,
      ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
    );
  }
}
