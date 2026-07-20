import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateSupervisorUserDto {
  @ApiProperty({ example: 'SUP-002' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  employeeId!: string;

  @ApiProperty({ example: 'supervisor2@example.com' })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiPropertyOptional({ example: '+23277000001' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiProperty({ example: 'Aminata' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  firstName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  middleName?: string;

  @ApiProperty({ example: 'Koroma' })
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

export class CreateSupervisorProfileDto {
  @ApiProperty({ example: 'GT-SUP-002' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  supervisorNumber!: string;

  @ApiPropertyOptional({ example: 'Shift Supervisor' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}

export class CreateSupervisorDto {
  @ApiProperty({ type: CreateSupervisorUserDto })
  @ValidateNested()
  @Type(() => CreateSupervisorUserDto)
  user!: CreateSupervisorUserDto;

  @ApiProperty({ type: CreateSupervisorProfileDto })
  @ValidateNested()
  @Type(() => CreateSupervisorProfileDto)
  profile!: CreateSupervisorProfileDto;
}
