import { Global, Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';

@Global()
@Module({
  providers: [ApiKeyService],
  exports: [ApiKeyService],
})
export class ApiKeysModule {}
