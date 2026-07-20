import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class StartPatrolAssignmentDto {
  @ApiProperty({ example: '2026-07-20T22:02:00.000Z' })
  @IsDateString()
  deviceTimestamp!: string;

  @ApiProperty({ example: 'patrol-start-local-uuid' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey!: string;
}
