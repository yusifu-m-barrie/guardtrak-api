import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  shiftId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  officerId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  supervisorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
