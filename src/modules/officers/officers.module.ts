import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OfficersController } from './officers.controller';
import { OfficersService } from './officers.service';

@Module({
  imports: [AuthModule],
  controllers: [OfficersController],
  providers: [OfficersService],
  exports: [OfficersService],
})
export class OfficersModule {}
