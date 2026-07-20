import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../constants/metadata-keys';
import type { UserRole } from '../enums/user-role.enum';

/**
 * Restricts a route to the listed roles.
 * Effective once RolesGuard is registered in Phase 3.
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
