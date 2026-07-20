import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ClientStatus } from '../../../../generated/prisma/client';

export class UpdateClientStatusDto {
  @ApiProperty({ enum: ClientStatus, example: ClientStatus.INACTIVE })
  @IsEnum(ClientStatus)
  status!: ClientStatus;

  @ApiPropertyOptional({ example: 'No longer active contract' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
