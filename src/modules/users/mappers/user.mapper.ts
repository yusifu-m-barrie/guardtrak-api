import type { User } from '../../../../generated/prisma/client';

export function mapUserResponse(user: User) {
  return {
    id: user.id,
    organisationId: user.organisationId,
    employeeId: user.employeeId,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    middleName: user.middleName,
    lastName: user.lastName,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    passwordChangedAt: user.passwordChangedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
