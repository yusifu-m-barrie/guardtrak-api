import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: 'FOLPS' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  organisationCode!: string;

  @ApiProperty({ example: 'OFF-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  employeeId!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  otp!: string;
}
