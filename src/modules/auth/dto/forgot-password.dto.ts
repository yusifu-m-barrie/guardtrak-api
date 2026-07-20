import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'GUARDTRAK' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  organisationCode!: string;

  @ApiProperty({ example: 'OFF-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  employeeId!: string;
}
