import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateShiftDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  siteId!: string;

  @ApiProperty({ example: 'Night Security Shift' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: '2026-07-20T18:00:00.000Z' })
  @IsDateString()
  scheduledStartAt!: string;

  @ApiProperty({ example: '2026-07-21T06:00:00.000Z' })
  @IsDateString()
  scheduledEndAt!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  unpaidBreakMinutes?: number;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  gracePeriodMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  overtimeThresholdMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  instructions?: string;

  @ApiPropertyOptional({
    description: 'When true, creates shift as DRAFT instead of SCHEDULED',
  })
  @IsOptional()
  @IsBoolean()
  asDraft?: boolean;
}
