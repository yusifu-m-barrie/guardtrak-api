import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AssignmentStatus } from '../../../../generated/prisma/client';

export class UpdateAssignmentStatusDto {
  @ApiProperty({ enum: AssignmentStatus })
  @IsEnum(AssignmentStatus)
  status!: AssignmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
