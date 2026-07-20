import { Module } from '@nestjs/common';
import { AssignmentsModule } from '../assignments/assignments.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmergenciesController } from './emergencies.controller';
import { EmergenciesService } from './emergencies.service';

@Module({
  imports: [AuthModule, AssignmentsModule, NotificationsModule],
  controllers: [EmergenciesController],
  providers: [EmergenciesService],
  exports: [EmergenciesService],
})
export class EmergenciesModule {}
