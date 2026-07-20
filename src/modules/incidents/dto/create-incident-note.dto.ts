import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IncidentNoteVisibility } from '../../../../generated/prisma/client';

export class CreateIncidentNoteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  body!: string;

  @ApiPropertyOptional({ enum: IncidentNoteVisibility })
  @IsOptional()
  @IsEnum(IncidentNoteVisibility)
  visibility?: IncidentNoteVisibility;
}
