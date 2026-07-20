import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PatrolRouteStatus } from '../../../../generated/prisma/client';

export class UpdatePatrolRouteStatusDto {
  @ApiProperty({ enum: PatrolRouteStatus })
  @IsEnum(PatrolRouteStatus)
  status!: PatrolRouteStatus;
}
