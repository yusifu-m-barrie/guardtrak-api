import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';
import { trimOrUndefined } from '../../../common/utils/normalize.util';
import { Transform } from 'class-transformer';
import { transformIfString } from '../../../common/utils/transform.util';

export class UpdateOrganisationDto {
  @ApiPropertyOptional({ example: 'Faith Of Life Protective Services' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, trimOrUndefined),
  )
  name?: string;

  @ApiPropertyOptional({ example: 'Faith Of Life Protective Services Ltd' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, trimOrUndefined),
  )
  legalName?: string;

  @ApiPropertyOptional({ example: 'GT-2026-001' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, trimOrUndefined),
  )
  registrationNumber?: string;

  @ApiPropertyOptional({ example: 'contact@guardtrak.example' })
  @IsOptional()
  @IsEmail()
  @MaxLength(191)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, trimOrUndefined),
  )
  email?: string;

  @ApiPropertyOptional({ example: '+23276000000' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, trimOrUndefined),
  )
  phone?: string;

  @ApiPropertyOptional({ example: 'Freetown, Sierra Leone' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, trimOrUndefined),
  )
  address?: string;

  @ApiPropertyOptional({ example: 'SL' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional({ example: 'Africa/Freetown' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example/logo.png' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) =>
    transformIfString(value, trimOrUndefined),
  )
  logoUrl?: string | null;
}
