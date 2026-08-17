import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ClockInDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  assignmentId!: string;

  @ApiPropertyOptional({
    example: '2026-08-17',
    description:
      'Occurrence calendar date (YYYY-MM-DD). Accepted only for yesterday, today, or tomorrow in the shift timezone.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  occurrenceDate?: string;

  @ApiProperty({ example: '2026-07-20T17:58:12.000Z' })
  @IsDateString()
  deviceTimestamp!: string;

  @ApiProperty({ example: 8.8833 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: -12.05 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({ example: 18.5 })
  @IsNumber()
  @Min(0)
  accuracyMeters!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  evidenceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  localAttendanceId?: string;

  @ApiProperty({ example: 'clock-in-mobile-local-uuid' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey!: string;
}
