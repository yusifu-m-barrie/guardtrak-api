import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole } from '../../../../generated/prisma/client';

const ASSIGNABLE_ROLES = [
  UserRole.SECURITY_OFFICER,
  UserRole.SUPERVISOR,
  UserRole.ADMINISTRATOR,
] as const;

export class UpdateUserRoleDto {
  @ApiProperty({
    enum: ASSIGNABLE_ROLES,
    example: UserRole.SUPERVISOR,
  })
  @IsEnum(ASSIGNABLE_ROLES)
  role!: (typeof ASSIGNABLE_ROLES)[number];
}
