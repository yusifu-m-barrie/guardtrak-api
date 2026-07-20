import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ShiftStatus } from '../../../../generated/prisma/client';

export class UpdateShiftStatusDto {
  @ApiProperty({ enum: ShiftStatus })
  @IsEnum(ShiftStatus)
  status!: ShiftStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
