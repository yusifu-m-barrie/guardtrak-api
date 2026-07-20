import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccountStatus } from '../../../../generated/prisma/client';

const STATUS_UPDATE_VALUES = [
  AccountStatus.INVITED,
  AccountStatus.ACTIVE,
  AccountStatus.SUSPENDED,
  AccountStatus.DISABLED,
] as const;

export class UpdateUserStatusDto {
  @ApiProperty({
    enum: STATUS_UPDATE_VALUES,
    example: AccountStatus.SUSPENDED,
  })
  @IsEnum(STATUS_UPDATE_VALUES)
  status!: (typeof STATUS_UPDATE_VALUES)[number];

  @ApiPropertyOptional({ example: 'Administrative suspension' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
