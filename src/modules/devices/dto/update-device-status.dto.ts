import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DeviceStatus } from '../../../../generated/prisma/client';

export class UpdateDeviceStatusDto {
  @ApiProperty({ enum: DeviceStatus, example: DeviceStatus.REVOKED })
  @IsEnum(DeviceStatus)
  status!: DeviceStatus;

  @ApiPropertyOptional({ example: 'Lost device' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
