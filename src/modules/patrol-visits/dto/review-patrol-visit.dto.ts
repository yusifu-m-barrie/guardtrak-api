import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReviewPatrolVisitDto {
  @ApiProperty({ example: 'Officer location confirmed from site CCTV.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
