import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../../../../generated/prisma/client';
import {
  normalizeEmail,
  normalizeEmployeeId,
  normalizePersonName,
  normalizePhone,
  trimOrUndefined,
} from '../../../common/utils/normalize.util';
import { transformIfString } from '../../../common/utils/transform.util';

export class CreateUserDto {
  @ApiProperty({ example: 'OFF-002' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, normalizeEmployeeId),
  )
  employeeId!: string;

  @ApiProperty({ example: 'officer2@example.com' })
  @IsEmail()
  @MaxLength(191)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, normalizeEmail),
  )
  email!: string;

  @ApiPropertyOptional({ example: '+23276000000' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, normalizePhone),
  )
  phone?: string | null;

  @ApiProperty({ example: 'Mariama' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, normalizePersonName),
  )
  firstName!: string;

  @ApiPropertyOptional({ example: 'Aminata' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, trimOrUndefined),
  )
  middleName?: string;

  @ApiProperty({ example: 'Kamara' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, normalizePersonName),
  )
  lastName!: string;

  @ApiPropertyOptional({ example: 'Mariama Kamara' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, trimOrUndefined),
  )
  displayName?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.SECURITY_OFFICER })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({ example: 'Strong!Temporary2026' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(128)
  temporaryPassword!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}
