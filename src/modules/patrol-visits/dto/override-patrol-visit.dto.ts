import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CheckpointStatus } from '../../../../generated/prisma/client';

export class OverridePatrolVisitDto {
  @ApiProperty({ example: 'Checkpoint inaccessible due to construction.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;

  @ApiPropertyOptional({
    enum: [
      CheckpointStatus.COMPLETED,
      CheckpointStatus.SKIPPED,
      CheckpointStatus.MISSED,
    ],
  })
  @IsOptional()
  @IsEnum(CheckpointStatus)
  markAs?: CheckpointStatus;
}
