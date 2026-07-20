import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { PatrolsSharedModule } from '../patrols/patrols-shared.module';
import { PatrolAssignmentVisitsController } from './patrol-assignment-visits.controller';
import { PatrolVisitsController } from './patrol-visits.controller';
import { PatrolVisitsService } from './patrol-visits.service';

@Module({
  imports: [AuthModule, AttendanceModule, PatrolsSharedModule],
  controllers: [PatrolAssignmentVisitsController, PatrolVisitsController],
  providers: [PatrolVisitsService],
  exports: [PatrolVisitsService],
})
export class PatrolVisitsModule {}
