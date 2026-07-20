import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SupportRequestStatus } from '../../../../generated/prisma/client';

export class UpdateSupportStatusDto {
  @ApiProperty({ enum: SupportRequestStatus })
  @IsEnum(SupportRequestStatus)
  status!: SupportRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
