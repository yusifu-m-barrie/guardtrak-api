import type {
  OfficerProfile,
  Organisation,
  SupervisorOfficer,
  SupervisorProfile,
  User,
} from '../../../../generated/prisma/client';

export interface OfficerMapperOptions {
  includeNotes?: boolean;
}

export type SafeUserPayload = Pick<
  User,
  | 'id'
  | 'organisationId'
  | 'employeeId'
  | 'email'
  | 'phone'
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'displayName'
  | 'role'
  | 'status'
  | 'avatarUrl'
  | 'mustChangePassword'
  | 'lastLoginAt'
  | 'createdAt'
  | 'updatedAt'
>;

export type SupervisorSummaryUser = Pick<
  User,
  'id' | 'employeeId' | 'firstName' | 'lastName' | 'displayName'
>;

const OFFICER_USER_FIELDS = [
  'id',
  'organisationId',
  'employeeId',
  'email',
  'phone',
  'firstName',
  'middleName',
  'lastName',
  'displayName',
  'role',
  'status',
  'avatarUrl',
  'mustChangePassword',
  'lastLoginAt',
  'createdAt',
  'updatedAt',
] as const;

export function mapOfficerUser(user: SafeUserPayload) {
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

export function mapOfficerProfile(
  profile: OfficerProfile,
  options: OfficerMapperOptions = {},
) {
  const base = {
    id: profile.id,
    organisationId: profile.organisationId,
    userId: profile.userId,
    officerNumber: profile.officerNumber,
    employmentStatus: profile.employmentStatus,
    hireDate: profile.hireDate,
    gender: profile.gender,
    residentialAddress: profile.residentialAddress,
    emergencyContactName: profile.emergencyContactName,
    emergencyContactPhone: profile.emergencyContactPhone,
    emergencyContactRelationship: profile.emergencyContactRelationship,
    rankOrTitle: profile.rankOrTitle,
    skills: profile.skills,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };

  if (options.includeNotes) {
    return { ...base, notes: profile.notes };
  }

  return base;
}

export function mapOrganisationSummary(organisation: Organisation | null) {
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

export function mapSupervisorLink(
  link: SupervisorOfficer & {
    supervisor?: SupervisorProfile & {
      user?: SupervisorSummaryUser | null;
    };
  },
) {
  return {
    id: link.id,
    activeFrom: link.activeFrom,
    activeUntil: link.activeUntil,
    supervisor: link.supervisor
      ? {
          id: link.supervisor.id,
          supervisorNumber: link.supervisor.supervisorNumber,
          title: link.supervisor.title,
          user: link.supervisor.user
            ? {
                id: link.supervisor.user.id,
                employeeId: link.supervisor.user.employeeId,
                firstName: link.supervisor.user.firstName,
                lastName: link.supervisor.user.lastName,
                displayName: link.supervisor.user.displayName,
              }
            : null,
        }
      : null,
  };
}

export function mapOfficerDetail(
  profile: OfficerProfile & { user: SafeUserPayload },
  options: OfficerMapperOptions = {},
) {
  return {
    profile: mapOfficerProfile(profile, options),
    user: mapOfficerUser(profile.user),
  };
}

export function mapOfficerMe(
  profile: OfficerProfile & {
    user: SafeUserPayload;
    organisation: Organisation;
    supervisorLinks?: (SupervisorOfficer & {
      supervisor?: SupervisorProfile & {
        user?: SupervisorSummaryUser | null;
      };
    })[];
  },
) {
  const activeSupervisors = (profile.supervisorLinks ?? []).filter(
    (link) => !link.activeUntil || link.activeUntil > new Date(),
  );

  return {
    user: mapOfficerUser(profile.user),
    profile: mapOfficerProfile(profile),
    organisation: mapOrganisationSummary(profile.organisation),
    supervisors: activeSupervisors.map(mapSupervisorLink),
  };
}

export const OFFICER_USER_SELECT = Object.fromEntries(
  OFFICER_USER_FIELDS.map((field) => [field, true]),
) as Record<(typeof OFFICER_USER_FIELDS)[number], true>;
