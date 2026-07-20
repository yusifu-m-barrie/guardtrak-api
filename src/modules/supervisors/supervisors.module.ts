import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupervisorsController } from './supervisors.controller';
import { SupervisorsService } from './supervisors.service';

@Module({
  imports: [AuthModule],
  controllers: [SupervisorsController],
  providers: [SupervisorsService],
  exports: [SupervisorsService],
})
export class SupervisorsModule {}
