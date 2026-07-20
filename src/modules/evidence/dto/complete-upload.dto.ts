import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CompleteUploadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  evidenceId!: string;

  @ApiPropertyOptional({
    description: 'SHA-256 hex checksum of uploaded bytes',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  checksum?: string;

  @ApiPropertyOptional({
    description:
      'For local provider: ticket id from uploadUrl (local-upload://ticket)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  localTicketId?: string;

  @ApiPropertyOptional({
    description: 'Base64-encoded file body for local provider e2e/dev complete',
  })
  @IsOptional()
  @IsString()
  localFileBase64?: string;
}
