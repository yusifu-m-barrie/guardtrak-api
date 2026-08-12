import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssignmentsModule } from '../assignments/assignments.module';
import { PatrolRoutesController } from './patrol-routes.controller';
import { PatrolRoutesService } from './patrol-routes.service';

@Module({
  imports: [AuthModule, AssignmentsModule],
  controllers: [PatrolRoutesController],
  providers: [PatrolRoutesService],
  exports: [PatrolRoutesService],
})
export class PatrolRoutesModule {}
