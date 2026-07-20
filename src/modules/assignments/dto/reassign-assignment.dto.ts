import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ReassignAssignmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  replacementOfficerId!: string;

  @ApiProperty({ example: 'Original officer unavailable' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  supervisorId?: string;
}
