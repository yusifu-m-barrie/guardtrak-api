import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { GeofencePolicy } from '../../../../generated/prisma/client';
import {
  MAX_GPS_ACCURACY_METERS,
  MAX_SITE_RADIUS_METERS,
} from '../sites-validation.util';

export class UpdateSiteDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  clientId?: string;

  @ApiPropertyOptional({ example: 'Makeni Main Office' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'MKN-HQ' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: 8.8833 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -12.05 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(MAX_SITE_RADIUS_METERS)
  clockInRadiusMeters?: number;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(MAX_SITE_RADIUS_METERS)
  clockOutRadiusMeters?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(MAX_SITE_RADIUS_METERS)
  checkpointDefaultRadiusMeters?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(MAX_GPS_ACCURACY_METERS)
  minimumGpsAccuracyMeters?: number;

  @ApiPropertyOptional({ enum: GeofencePolicy })
  @IsOptional()
  @IsEnum(GeofencePolicy)
  clockInOutsideGeofencePolicy?: GeofencePolicy;

  @ApiPropertyOptional({ enum: GeofencePolicy })
  @IsOptional()
  @IsEnum(GeofencePolicy)
  clockOutOutsideGeofencePolicy?: GeofencePolicy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresClockInSelfie?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresClockOutSelfie?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresPatrol?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresFinalShiftNote?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  instructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  emergencyContactPhone?: string;
}
