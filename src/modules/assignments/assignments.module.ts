import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssignmentAccessService } from './assignment-access.service';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';

@Module({
  imports: [AuthModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService, AssignmentAccessService],
  exports: [AssignmentsService, AssignmentAccessService],
})
export class AssignmentsModule {}
