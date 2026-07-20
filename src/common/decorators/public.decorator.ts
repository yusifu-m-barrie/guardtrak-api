import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants/metadata-keys';

/**
 * Marks a route as publicly accessible (no JWT required).
 * Effective once JwtAuthGuard is registered globally in Phase 3.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
