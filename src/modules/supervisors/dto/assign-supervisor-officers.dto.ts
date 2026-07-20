import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class AssignSupervisorOfficersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  officerIds!: string[];

  @ApiProperty({ example: '2026-07-18T00:00:00.000Z' })
  @IsDateString()
  activeFrom!: string;

  @ApiPropertyOptional({ example: '2027-07-18T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  activeUntil?: string;
}
