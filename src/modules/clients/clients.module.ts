import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssignmentsModule } from '../assignments/assignments.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [AuthModule, AssignmentsModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
