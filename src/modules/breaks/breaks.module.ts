import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssignmentsModule } from '../assignments/assignments.module';
import { BreaksController } from './breaks.controller';
import { BreaksService } from './breaks.service';

@Module({
  imports: [AuthModule, AssignmentsModule],
  controllers: [BreaksController],
  providers: [BreaksService],
  exports: [BreaksService],
})
export class BreaksModule {}
