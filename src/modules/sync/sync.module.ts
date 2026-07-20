import { Module } from '@nestjs/common';
import { EmergenciesModule } from '../emergencies/emergencies.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { SupportModule } from '../support/support.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [IncidentsModule, EmergenciesModule, SupportModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
