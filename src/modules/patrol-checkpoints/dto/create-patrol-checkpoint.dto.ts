import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CheckpointVerificationMethod } from '../../../../generated/prisma/client';

export class CreatePatrolCheckpointDto {
  @ApiProperty({ example: 'Main Gate' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(500)
  sequence!: number;

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

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  allowedRadiusMeters!: number;

  @ApiProperty({
    enum: CheckpointVerificationMethod,
    example: CheckpointVerificationMethod.GPS_AND_QR,
  })
  @IsEnum(CheckpointVerificationMethod)
  verificationMethod!: CheckpointVerificationMethod;

  @ApiPropertyOptional({ example: 'GT-MKN-HQ-GATE-001' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  qrCodeValue?: string;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  minimumGpsAccuracyMeters?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresPhoto?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresNote?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  instructions?: string;
}
