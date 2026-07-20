import { Module } from '@nestjs/common';
import { AssignmentsModule } from '../assignments/assignments.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IncidentAccessService } from './incident-access.service';
import { IncidentAuditService } from './incident-audit.service';
import { IncidentNumberService } from './incident-number.service';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [AuthModule, AssignmentsModule, NotificationsModule],
  controllers: [IncidentsController],
  providers: [
    IncidentsService,
    IncidentAccessService,
    IncidentAuditService,
    IncidentNumberService,
  ],
  exports: [IncidentsService, IncidentAccessService],
})
export class IncidentsModule {}
