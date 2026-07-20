import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CorrectAttendanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  clockInServerAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  clockOutServerAt?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
