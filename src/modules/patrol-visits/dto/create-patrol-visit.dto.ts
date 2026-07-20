import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CheckpointVerificationMethod } from '../../../../generated/prisma/client';

export class CreatePatrolVisitDto {
  @ApiProperty({ enum: CheckpointVerificationMethod })
  @IsEnum(CheckpointVerificationMethod)
  verificationMethod!: CheckpointVerificationMethod;

  @ApiProperty({ example: '2026-07-20T22:15:00.000Z' })
  @IsDateString()
  deviceTimestamp!: string;

  @ApiProperty({ example: 8.4657 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: -13.2317 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({ example: 12.5 })
  @IsNumber()
  @Min(0)
  accuracyMeters!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  qrCodeValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  evidenceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  localVisitId?: string;

  @ApiProperty({ example: 'visit-local-patrol-visit-uuid' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey!: string;
}
