import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssignmentsModule } from '../assignments/assignments.module';
import { PatrolAccessService } from './patrol-access.service';
import { PatrolProgressService } from './patrol-progress.service';

@Module({
  imports: [AuthModule, AssignmentsModule],
  providers: [PatrolAccessService, PatrolProgressService],
  exports: [PatrolAccessService, PatrolProgressService],
})
export class PatrolsSharedModule {}
