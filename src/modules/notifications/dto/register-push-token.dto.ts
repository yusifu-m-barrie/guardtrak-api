import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterPushTokenDto {
  @ApiProperty({ description: 'Device installation ID from auth/login' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  installationId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;

  @ApiPropertyOptional({ default: 'fcm' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  provider?: string;
}
