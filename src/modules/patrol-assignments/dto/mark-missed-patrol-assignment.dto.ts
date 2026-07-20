import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class MarkMissedPatrolAssignmentDto {
  @ApiProperty({ example: 'Officer did not start patrol within window.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
