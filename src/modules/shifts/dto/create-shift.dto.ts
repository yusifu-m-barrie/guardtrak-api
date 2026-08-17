import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RecurrenceType } from '../../../../generated/prisma/client';

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

  @ApiProperty({ example: '2026-08-17T18:00:00.000Z' })
  @IsDateString()
  scheduledStartAt!: string;

  @ApiProperty({ example: '2026-08-17T21:00:00.000Z' })
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

  @ApiPropertyOptional({ enum: RecurrenceType, default: RecurrenceType.NONE })
  @IsOptional()
  @IsEnum(RecurrenceType)
  recurrenceType?: RecurrenceType;

  @ApiPropertyOptional({
    description:
      'Inclusive last calendar date a recurring occurrence may start',
  })
  @IsOptional()
  @IsDateString()
  recurrenceEndAt?: string;

  @ApiPropertyOptional({
    description: '0=Sunday … 6=Saturday. Required for CUSTOM_WEEKDAYS.',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  recurrenceDaysOfWeek?: number[];

  @ApiPropertyOptional({
    example: 'America/New_York',
    description: 'IANA timezone. Defaults to the organisation timezone.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}
