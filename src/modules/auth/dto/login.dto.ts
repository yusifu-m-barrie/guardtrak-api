import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DevicePlatform } from '../../../../generated/prisma/client';

export class LoginDto {
  @ApiProperty({ example: 'FOLPS' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  organisationCode!: string;

  @ApiProperty({ example: 'OFF-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  employeeId!: string;

  @ApiProperty({ example: '********' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'stable-device-installation-id' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  installationId!: string;

  @ApiProperty({ enum: DevicePlatform, example: DevicePlatform.ANDROID })
  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @ApiPropertyOptional({ example: 'Samsung Galaxy' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  operatingSystem?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  operatingSystemVersion?: string;
}
