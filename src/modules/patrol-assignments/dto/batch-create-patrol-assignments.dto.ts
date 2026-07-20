import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreatePatrolAssignmentDto } from './create-patrol-assignment.dto';

export class BatchCreatePatrolAssignmentsDto {
  @ApiProperty({ type: [CreatePatrolAssignmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePatrolAssignmentDto)
  assignments!: CreatePatrolAssignmentDto[];
}
