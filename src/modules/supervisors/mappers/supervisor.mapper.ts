import type {
  OfficerProfile,
  SupervisorOfficer,
  SupervisorProfile,
} from '../../../../generated/prisma/client';
import {
  mapOfficerProfile,
  mapOfficerUser,
  type SafeUserPayload,
} from '../../officers/mappers/officer.mapper';

export function mapSupervisorUser(user: SafeUserPayload) {
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
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function mapSupervisorProfile(profile: SupervisorProfile) {
  return {
    id: profile.id,
    organisationId: profile.organisationId,
    userId: profile.userId,
    supervisorNumber: profile.supervisorNumber,
    title: profile.title,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export function mapSupervisorDetail(
  profile: SupervisorProfile & { user: SafeUserPayload },
) {
  return {
    profile: mapSupervisorProfile(profile),
    user: mapSupervisorUser(profile.user),
  };
}

export function mapAssignedOfficer(
  link: SupervisorOfficer & {
    officer: OfficerProfile & { user: SafeUserPayload };
  },
) {
  return {
    relationId: link.id,
    activeFrom: link.activeFrom,
    activeUntil: link.activeUntil,
    officer: {
      profile: mapOfficerProfile(link.officer),
      user: mapOfficerUser(link.officer.user),
    },
  };
}

export function mapSupervisorMe(
  profile: SupervisorProfile & {
    user: SafeUserPayload;
    officerLinks?: (SupervisorOfficer & {
      officer: OfficerProfile & { user: SafeUserPayload };
    })[];
  },
) {
  const activeOfficers = (profile.officerLinks ?? []).filter(
    (link) => !link.activeUntil || link.activeUntil > new Date(),
  );

  return {
    user: mapSupervisorUser(profile.user),
    profile: mapSupervisorProfile(profile),
    assignedOfficers: activeOfficers.map(mapAssignedOfficer),
  };
}

export const SUPERVISOR_USER_SELECT = {
  id: true,
  organisationId: true,
  employeeId: true,
  email: true,
  phone: true,
  firstName: true,
  middleName: true,
  lastName: true,
  displayName: true,
  role: true,
  status: true,
  avatarUrl: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
