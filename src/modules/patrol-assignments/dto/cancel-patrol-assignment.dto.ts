import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelPatrolAssignmentDto {
  @ApiProperty({ example: 'Shift reassigned.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
