import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssignmentsModule } from '../assignments/assignments.module';
import { AttendanceAuditService } from './attendance-audit.service';
import { AttendanceCalculationService } from './attendance-calculation.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { GeofenceService } from './geofence.service';

@Module({
  imports: [AuthModule, AssignmentsModule],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    AttendanceAuditService,
    AttendanceCalculationService,
    GeofenceService,
  ],
  exports: [AttendanceService, AttendanceCalculationService, GeofenceService],
})
export class AttendanceModule {}
