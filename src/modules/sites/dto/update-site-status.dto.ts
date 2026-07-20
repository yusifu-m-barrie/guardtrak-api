import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SiteStatus } from '../../../../generated/prisma/client';

export class UpdateSiteStatusDto {
  @ApiProperty({ enum: SiteStatus, example: SiteStatus.INACTIVE })
  @IsEnum(SiteStatus)
  status!: SiteStatus;

  @ApiPropertyOptional({ example: 'Site temporarily closed' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
