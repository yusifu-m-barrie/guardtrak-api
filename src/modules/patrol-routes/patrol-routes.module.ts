import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PatrolRoutesController } from './patrol-routes.controller';
import { PatrolRoutesService } from './patrol-routes.service';

@Module({
  imports: [AuthModule],
  controllers: [PatrolRoutesController],
  providers: [PatrolRoutesService],
  exports: [PatrolRoutesService],
})
export class PatrolRoutesModule {}
