import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { IDEMPOTENCY_STORE } from './idempotency.interface';
import { IdempotencyService } from './idempotency.service';
import { PrismaIdempotencyStore } from './prisma-idempotency.store';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    PrismaIdempotencyStore,
    IdempotencyService,
    {
      provide: IDEMPOTENCY_STORE,
      useExisting: PrismaIdempotencyStore,
    },
  ],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
