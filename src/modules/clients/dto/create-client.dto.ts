import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ example: 'Example Holdings' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'Example Holdings Limited' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional({ example: 'EX-2026-001' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  registrationNumber?: string;

  @ApiProperty({ example: 'Example Person' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  primaryContactName!: string;

  @ApiPropertyOptional({ example: 'contact@example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(254)
  primaryContactEmail?: string;

  @ApiPropertyOptional({ example: '+23279000000' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  primaryContactPhone?: string;

  @ApiPropertyOptional({ example: 'Makeni, Sierra Leone' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  billingAddress?: string;

  @ApiPropertyOptional({ example: 'Example operational notes' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  operationalNotes?: string;
}
