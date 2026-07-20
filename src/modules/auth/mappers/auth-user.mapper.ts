import type {
  OfficerProfile,
  Organisation,
  SupervisorProfile,
  User,
} from '../../../../generated/prisma/client';
import { getPermissionsForRole } from '../permissions/role-permissions';
import type { UserRole } from '../../../common/enums/user-role.enum';

export function mapUserSummary(user: User) {
  return {
    id: user.id,
    organisationId: user.organisationId,
    employeeId: user.employeeId,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    mustChangePassword: user.mustChangePassword,
  };
}

export function mapOfficerProfile(profile: OfficerProfile | null | undefined) {
  if (!profile) {
    return null;
  }
  return {
    id: profile.id,
    officerNumber: profile.officerNumber,
    employmentStatus: profile.employmentStatus,
    rankOrTitle: profile.rankOrTitle,
    hireDate: profile.hireDate,
  };
}

export function mapSupervisorProfile(
  profile: SupervisorProfile | null | undefined,
) {
  if (!profile) {
    return null;
  }
  return {
    id: profile.id,
    supervisorNumber: profile.supervisorNumber,
    title: profile.title,
  };
}

export function mapOrganisationSummary(
  organisation: Organisation | null | undefined,
) {
  if (!organisation) {
    return null;
  }
  return {
    id: organisation.id,
    code: organisation.code,
    name: organisation.name,
    timezone: organisation.timezone,
    status: organisation.status,
  };
}

export function buildAuthUserPayload(
  user: User & {
    officerProfile?: OfficerProfile | null;
    supervisorProfile?: SupervisorProfile | null;
    organisation?: Organisation | null;
  },
) {
  return {
    user: mapUserSummary(user),
    officer: mapOfficerProfile(user.officerProfile),
    supervisor: mapSupervisorProfile(user.supervisorProfile),
    organisation: mapOrganisationSummary(user.organisation),
    permissions: getPermissionsForRole(user.role as UserRole),
  };
}
