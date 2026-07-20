import { Module } from '@nestjs/common';
import { AppLoggerService } from '../common/logging/app-logger.service';
import { IdempotencyModule } from '../common/idempotency/idempotency.module';

/**
 * Shared cross-cutting providers that are not domain-specific.
 */
@Module({
  imports: [IdempotencyModule],
  providers: [AppLoggerService],
  exports: [AppLoggerService, IdempotencyModule],
})
export class SharedModule {}
