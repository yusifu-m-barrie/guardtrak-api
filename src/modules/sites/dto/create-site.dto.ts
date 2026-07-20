import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
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
import { GeofencePolicy } from '../../../../generated/prisma/client';
import {
  MAX_GPS_ACCURACY_METERS,
  MAX_SITE_RADIUS_METERS,
} from '../sites-validation.util';

export class CreateSiteDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  clientId!: string;

  @ApiProperty({ example: 'Makeni Main Office' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'MKN-HQ' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code!: string;

  @ApiProperty({ example: 'Makeni, Sierra Leone' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;

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

  @ApiProperty({ example: 150 })
  @IsNumber()
  @Min(1)
  @Max(MAX_SITE_RADIUS_METERS)
  clockInRadiusMeters!: number;

  @ApiProperty({ example: 150 })
  @IsNumber()
  @Min(1)
  @Max(MAX_SITE_RADIUS_METERS)
  clockOutRadiusMeters!: number;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(MAX_SITE_RADIUS_METERS)
  checkpointDefaultRadiusMeters?: number;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(MAX_GPS_ACCURACY_METERS)
  minimumGpsAccuracyMeters?: number;

  @ApiPropertyOptional({
    enum: GeofencePolicy,
    default: GeofencePolicy.REQUIRE_SUPERVISOR_APPROVAL,
  })
  @IsOptional()
  @IsEnum(GeofencePolicy)
  clockInOutsideGeofencePolicy?: GeofencePolicy;

  @ApiPropertyOptional({
    enum: GeofencePolicy,
    default: GeofencePolicy.ALLOW_WITH_REASON,
  })
  @IsOptional()
  @IsEnum(GeofencePolicy)
  clockOutOutsideGeofencePolicy?: GeofencePolicy;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresClockInSelfie?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresClockOutSelfie?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresPatrol?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresFinalShiftNote?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  instructions?: string;

  @ApiPropertyOptional({ example: 'Site Manager' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: '+23276000000' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  emergencyContactPhone?: string;
}
