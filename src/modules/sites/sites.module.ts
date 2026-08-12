import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssignmentsModule } from '../assignments/assignments.module';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';

@Module({
  imports: [AuthModule, AssignmentsModule],
  controllers: [SitesController],
  providers: [SitesService],
  exports: [SitesService],
})
export class SitesModule {}
