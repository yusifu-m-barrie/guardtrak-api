import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssignmentsModule } from '../assignments/assignments.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { PatrolsSharedModule } from '../patrols/patrols-shared.module';
import { PatrolAssignmentsController } from './patrol-assignments.controller';
import { PatrolAssignmentsService } from './patrol-assignments.service';

@Module({
  imports: [
    AuthModule,
    PatrolsSharedModule,
    AssignmentsModule,
    AttendanceModule,
  ],
  controllers: [PatrolAssignmentsController],
  providers: [PatrolAssignmentsService],
  exports: [PatrolAssignmentsService],
})
export class PatrolAssignmentsModule {}
