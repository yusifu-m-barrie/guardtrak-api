import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateClientDto {
  @ApiPropertyOptional({ example: 'Example Holdings' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

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

  @ApiPropertyOptional({ example: 'Example Person' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  primaryContactName?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  operationalNotes?: string;
}
