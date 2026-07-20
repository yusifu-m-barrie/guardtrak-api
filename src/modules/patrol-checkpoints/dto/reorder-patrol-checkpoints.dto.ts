import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReorderCheckpointItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  checkpointId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(500)
  sequence!: number;
}

export class ReorderPatrolCheckpointsDto {
  @ApiProperty({ type: [ReorderCheckpointItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderCheckpointItemDto)
  checkpoints!: ReorderCheckpointItemDto[];
}
