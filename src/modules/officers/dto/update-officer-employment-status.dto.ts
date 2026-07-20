import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { OfficerEmploymentStatus } from '../../../../generated/prisma/client';

export class UpdateOfficerEmploymentStatusDto {
  @ApiProperty({ enum: OfficerEmploymentStatus, example: 'ON_LEAVE' })
  @IsEnum(OfficerEmploymentStatus)
  employmentStatus!: OfficerEmploymentStatus;

  @ApiPropertyOptional({ example: 'Annual leave' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}
