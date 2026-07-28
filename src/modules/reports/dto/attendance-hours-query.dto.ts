import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { AttendanceStatus } from '../../../../generated/prisma/client';

export const ATTENDANCE_REPORT_TYPES = [
  'detail',
  'by-site',
  'officer-site',
  'officer-all-sites',
  'all-officers',
  'officer-site-breakdown',
] as const;

export type AttendanceReportType = (typeof ATTENDANCE_REPORT_TYPES)[number];

function toStringArray(value: unknown): string[] | undefined {
  if (value == null || value === '') return undefined;
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return undefined;
}

export class AttendanceHoursQueryDto {
  @IsISO8601()
  from!: string;

  @IsISO8601()
  to!: string;

  @ApiPropertyOptional({
    description: 'Single officer profile ID (legacy alias for officerIds)',
  })
  @IsOptional()
  @IsString()
  officerId?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated officer profile IDs',
    type: String,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  officerIds?: string[];

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsOptional()
  @IsString()
  supervisorId?: string;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiPropertyOptional({
    enum: ATTENDANCE_REPORT_TYPES,
    default: 'detail',
  })
  @IsOptional()
  @IsIn(ATTENDANCE_REPORT_TYPES)
  reportType?: AttendanceReportType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
