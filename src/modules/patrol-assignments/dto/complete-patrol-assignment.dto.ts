import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CompletePatrolAssignmentDto {
  @ApiProperty({ example: '2026-07-20T22:50:00.000Z' })
  @IsDateString()
  deviceTimestamp!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  finalNote?: string;

  @ApiProperty({ example: 'complete-patrol-local-uuid' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey!: string;
}
