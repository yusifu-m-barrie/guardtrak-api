import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  normalizeEmail,
  normalizePersonName,
  normalizePhone,
  trimOrUndefined,
} from '../../../common/utils/normalize.util';
import { transformIfString } from '../../../common/utils/transform.util';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'officer2@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(191)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, normalizeEmail),
  )
  email?: string;

  @ApiPropertyOptional({ example: '+23276000000' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, normalizePhone),
  )
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Mariama' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, normalizePersonName),
  )
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, trimOrUndefined),
  )
  middleName?: string | null;

  @ApiPropertyOptional({ example: 'Kamara' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, normalizePersonName),
  )
  lastName?: string;

  @ApiPropertyOptional({ example: 'Mariama Kamara' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, trimOrUndefined),
  )
  displayName?: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example/avatar.png' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  avatarUrl?: string | null;
}
