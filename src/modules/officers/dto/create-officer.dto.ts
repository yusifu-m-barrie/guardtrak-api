import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { OfficerEmploymentStatus } from '../../../../generated/prisma/client';

export class CreateOfficerUserDto {
  @ApiProperty({ example: 'OFF-003' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  employeeId!: string;

  @ApiProperty({ example: 'officer3@example.com' })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiPropertyOptional({ example: '+23277000000' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiProperty({ example: 'Abu' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  firstName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  middleName?: string;

  @ApiProperty({ example: 'Sesay' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  lastName!: string;

  @ApiProperty({ example: 'Strong!Temporary2026' })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  temporaryPassword!: string;
}

export class CreateOfficerProfileDto {
  @ApiProperty({ example: 'GT-OFF-003' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  officerNumber!: string;

  @ApiPropertyOptional({ enum: OfficerEmploymentStatus })
  @IsOptional()
  @IsEnum(OfficerEmploymentStatus)
  employmentStatus?: OfficerEmploymentStatus;

  @ApiPropertyOptional({ example: '2026-07-18' })
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nationalIdNumber?: string;

  @ApiPropertyOptional({ example: '1990-01-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  residentialAddress?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  emergencyContactRelationship?: string;

  @ApiPropertyOptional({ example: 'Security Officer' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  rankOrTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  skills?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CreateOfficerDto {
  @ApiProperty({ type: CreateOfficerUserDto })
  @ValidateNested()
  @Type(() => CreateOfficerUserDto)
  user!: CreateOfficerUserDto;

  @ApiProperty({ type: CreateOfficerProfileDto })
  @ValidateNested()
  @Type(() => CreateOfficerProfileDto)
  profile!: CreateOfficerProfileDto;
}
