import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  SupportRequestCategory,
  SupportRequestPriority,
} from '../../../../generated/prisma/client';

export class CreateSupportRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  description!: string;

  @ApiPropertyOptional({ enum: SupportRequestCategory })
  @IsOptional()
  @IsEnum(SupportRequestCategory)
  category?: SupportRequestCategory;

  @ApiPropertyOptional({ enum: SupportRequestPriority })
  @IsOptional()
  @IsEnum(SupportRequestPriority)
  priority?: SupportRequestPriority;
}
