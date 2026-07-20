import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { PatrolCheckpointsController } from './patrol-checkpoints.controller';
import { PatrolCheckpointsService } from './patrol-checkpoints.service';
import { PatrolRouteCheckpointsController } from './patrol-route-checkpoints.controller';

@Module({
  imports: [AuthModule, ConfigModule, AttendanceModule],
  controllers: [PatrolRouteCheckpointsController, PatrolCheckpointsController],
  providers: [PatrolCheckpointsService],
  exports: [PatrolCheckpointsService],
})
export class PatrolCheckpointsModule {}
