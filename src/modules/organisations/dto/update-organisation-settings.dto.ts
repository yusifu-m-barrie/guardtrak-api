import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SecuritySettingsDto {
  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(128)
  passwordMinLength?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  mfaRequired?: boolean;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxFailedLogins?: number;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  lockoutMinutes?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(10080)
  sessionIdleMinutes?: number;
}

export class AttendanceSettingsDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  geofenceRequired?: boolean;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  gracePeriodMinutes?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(500)
  maxGpsAccuracyMeters?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  earlyClockInMinutes?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requirePhotoOnClockIn?: boolean;
}

export class PatrolSettingsDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requireSequential?: boolean;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(48)
  autoMarkMissedHours?: number;

  @ApiPropertyOptional({ default: 40 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(500)
  defaultCheckpointRadiusMeters?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requireGpsOnVisit?: boolean;
}

export class IncidentSettingsDto {
  @ApiPropertyOptional({ default: 24 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  slaHours?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requireGpsOnSubmit?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowDrafts?: boolean;

  @ApiPropertyOptional({ default: 8 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  maxEvidencePerIncident?: number;
}

export class EmergencySettingsDto {
  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  autoEscalateMinutes?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  notifyAllSupervisors?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requireGps?: boolean;
}

export class NotificationSettingsDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  sosCriticalAlways?: boolean;
}

export class SupportSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  supportEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  supportPhone?: string;

  @ApiPropertyOptional({ default: 48 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  slaResponseHours?: number;
}

export class EmailSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fromName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(191)
  fromEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(191)
  replyTo?: string;
}

export class StorageSettingsDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowImageUpload?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowVideoUpload?: boolean;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxImageMb?: number;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1024)
  maxVideoMb?: number;
}

export class SystemSettingsDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiPropertyOptional({ default: 'Africa/Freetown' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  defaultTimezone?: string;

  @ApiPropertyOptional({ default: 90 })
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(3650)
  auditRetentionDays?: number;
}

export class UpdateOrganisationSettingsDto {
  @ApiPropertyOptional({ type: SecuritySettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SecuritySettingsDto)
  security?: SecuritySettingsDto;

  @ApiPropertyOptional({ type: AttendanceSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AttendanceSettingsDto)
  attendance?: AttendanceSettingsDto;

  @ApiPropertyOptional({ type: PatrolSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PatrolSettingsDto)
  patrol?: PatrolSettingsDto;

  @ApiPropertyOptional({ type: IncidentSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => IncidentSettingsDto)
  incidents?: IncidentSettingsDto;

  @ApiPropertyOptional({ type: EmergencySettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmergencySettingsDto)
  emergency?: EmergencySettingsDto;

  @ApiPropertyOptional({ type: NotificationSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationSettingsDto)
  notifications?: NotificationSettingsDto;

  @ApiPropertyOptional({ type: SupportSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SupportSettingsDto)
  support?: SupportSettingsDto;

  @ApiPropertyOptional({ type: EmailSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmailSettingsDto)
  email?: EmailSettingsDto;

  @ApiPropertyOptional({ type: StorageSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StorageSettingsDto)
  storage?: StorageSettingsDto;

  @ApiPropertyOptional({ type: SystemSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SystemSettingsDto)
  system?: SystemSettingsDto;

  @ApiPropertyOptional({
    description: 'Arbitrary feature flags map',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, boolean>;
}
