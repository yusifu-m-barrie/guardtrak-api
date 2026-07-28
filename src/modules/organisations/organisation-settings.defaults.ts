export type OrganisationSettingsPayload = {
  security: {
    passwordMinLength: number;
    mfaRequired: boolean;
    maxFailedLogins: number;
    lockoutMinutes: number;
    sessionIdleMinutes: number;
  };
  attendance: {
    geofenceRequired: boolean;
    gracePeriodMinutes: number;
    maxGpsAccuracyMeters: number;
    earlyClockInMinutes: number;
    requirePhotoOnClockIn: boolean;
  };
  patrol: {
    requireSequential: boolean;
    autoMarkMissedHours: number;
    defaultCheckpointRadiusMeters: number;
    requireGpsOnVisit: boolean;
  };
  incidents: {
    slaHours: number;
    requireGpsOnSubmit: boolean;
    allowDrafts: boolean;
    maxEvidencePerIncident: number;
  };
  emergency: {
    autoEscalateMinutes: number;
    notifyAllSupervisors: boolean;
    requireGps: boolean;
  };
  notifications: {
    pushEnabled: boolean;
    emailEnabled: boolean;
    inAppEnabled: boolean;
    sosCriticalAlways: boolean;
  };
  support: {
    supportEmail: string;
    supportPhone: string;
    slaResponseHours: number;
  };
  email: {
    fromName: string;
    fromEmail: string;
    replyTo: string;
  };
  storage: {
    allowImageUpload: boolean;
    allowVideoUpload: boolean;
    maxImageMb: number;
    maxVideoMb: number;
  };
  system: {
    maintenanceMode: boolean;
    defaultTimezone: string;
    auditRetentionDays: number;
  };
  featureFlags: Record<string, boolean>;
};

export const DEFAULT_ORGANISATION_SETTINGS: OrganisationSettingsPayload = {
  security: {
    passwordMinLength: 10,
    mfaRequired: false,
    maxFailedLogins: 5,
    lockoutMinutes: 15,
    sessionIdleMinutes: 30,
  },
  attendance: {
    geofenceRequired: true,
    gracePeriodMinutes: 15,
    maxGpsAccuracyMeters: 50,
    earlyClockInMinutes: 30,
    requirePhotoOnClockIn: false,
  },
  patrol: {
    requireSequential: true,
    autoMarkMissedHours: 2,
    defaultCheckpointRadiusMeters: 40,
    requireGpsOnVisit: true,
  },
  incidents: {
    slaHours: 24,
    requireGpsOnSubmit: true,
    allowDrafts: true,
    maxEvidencePerIncident: 8,
  },
  emergency: {
    autoEscalateMinutes: 5,
    notifyAllSupervisors: true,
    requireGps: true,
  },
  notifications: {
    pushEnabled: true,
    emailEnabled: true,
    inAppEnabled: true,
    sosCriticalAlways: true,
  },
  support: {
    supportEmail: '',
    supportPhone: '',
    slaResponseHours: 48,
  },
  email: {
    fromName: 'GuardTrak',
    fromEmail: '',
    replyTo: '',
  },
  storage: {
    allowImageUpload: true,
    allowVideoUpload: true,
    maxImageMb: 10,
    maxVideoMb: 100,
  },
  system: {
    maintenanceMode: false,
    defaultTimezone: 'Africa/Freetown',
    auditRetentionDays: 90,
  },
  featureFlags: {},
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Deep-merge settings objects; arrays/objects replaced by section merge. */
export function mergeOrganisationSettings(
  current: unknown,
  patch: Partial<OrganisationSettingsPayload> | Record<string, unknown>,
): OrganisationSettingsPayload {
  const base = {
    ...DEFAULT_ORGANISATION_SETTINGS,
    ...(isPlainObject(current) ? current : {}),
  } as OrganisationSettingsPayload;

  const result: OrganisationSettingsPayload = {
    ...base,
    security: { ...base.security, ...(patch.security ?? {}) },
    attendance: { ...base.attendance, ...(patch.attendance ?? {}) },
    patrol: { ...base.patrol, ...(patch.patrol ?? {}) },
    incidents: { ...base.incidents, ...(patch.incidents ?? {}) },
    emergency: { ...base.emergency, ...(patch.emergency ?? {}) },
    notifications: { ...base.notifications, ...(patch.notifications ?? {}) },
    support: { ...base.support, ...(patch.support ?? {}) },
    email: { ...base.email, ...(patch.email ?? {}) },
    storage: { ...base.storage, ...(patch.storage ?? {}) },
    system: { ...base.system, ...(patch.system ?? {}) },
    featureFlags: {
      ...base.featureFlags,
      ...(isPlainObject(patch.featureFlags)
        ? (patch.featureFlags as Record<string, boolean>)
        : {}),
    },
  };

  return result;
}
