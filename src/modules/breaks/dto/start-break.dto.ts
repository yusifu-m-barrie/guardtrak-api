import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { BreakType } from '../../../../generated/prisma/client';

export class StartBreakDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  attendanceId!: string;

  @ApiProperty({ enum: BreakType })
  @IsEnum(BreakType)
  type!: BreakType;

  @ApiProperty({ example: '2026-07-20T22:00:00.000Z' })
  @IsDateString()
  deviceTimestamp!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  localBreakId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey!: string;
}
