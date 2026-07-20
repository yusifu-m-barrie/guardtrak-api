import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreatePatrolCheckpointDto } from './create-patrol-checkpoint.dto';

export class BatchCreatePatrolCheckpointsDto {
  @ApiProperty({ type: [CreatePatrolCheckpointDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePatrolCheckpointDto)
  checkpoints!: CreatePatrolCheckpointDto[];
}
