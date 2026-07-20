import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreatePatrolAssignmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  patrolRouteId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  assignmentId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledStartAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledEndAt?: string;
}
