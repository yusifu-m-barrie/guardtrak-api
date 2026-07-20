import { Module } from '@nestjs/common';
import { SecurityIntelService } from './security-intel.service';

@Module({
  providers: [SecurityIntelService],
  exports: [SecurityIntelService],
})
export class SecurityIntelModule {}
