import type {
  EmailProviderName,
  GuardTrakConfig,
  NodeEnvironment,
  StorageProvider,
} from './config.types';
import { parseCorsOrigins } from '../common/utils/cors.util';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') {
    return fallback;
  }
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

function parseCsvList(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function resolveEnableSwagger(
  nodeEnv: NodeEnvironment,
  explicit?: string,
): boolean {
  if (explicit !== undefined && explicit !== '') {
    return parseBoolean(explicit, false);
  }
  return nodeEnv === 'development' || nodeEnv === 'staging';
}

export default (): GuardTrakConfig => {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as NodeEnvironment;

  return {
    app: {
      nodeEnv,
      port: Number.parseInt(process.env.PORT ?? '3000', 10),
      apiPrefix: process.env.API_PREFIX ?? 'api/v1',
      logLevel: process.env.LOG_LEVEL ?? 'log',
      enableSwagger: resolveEnableSwagger(nodeEnv, process.env.ENABLE_SWAGGER),
    },
    database: {
      url: process.env.DATABASE_URL ?? '',
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
      issuer: process.env.JWT_ISSUER ?? 'guardtrak-api',
      audience: process.env.JWT_AUDIENCE ?? 'guardtrak-clients',
    },
    auth: {
      maxFailedAttempts: Number.parseInt(
        process.env.AUTH_MAX_FAILED_ATTEMPTS ?? '5',
        10,
      ),
      lockoutMinutes: Number.parseInt(
        process.env.AUTH_LOCKOUT_MINUTES ?? '15',
        10,
      ),
      passwordResetOtpExpiresMinutes: Number.parseInt(
        process.env.AUTH_PASSWORD_RESET_OTP_EXPIRES_MINUTES ?? '10',
        10,
      ),
      passwordResetMaxAttempts: Number.parseInt(
        process.env.AUTH_PASSWORD_RESET_MAX_ATTEMPTS ?? '5',
        10,
      ),
      resetTokenExpiresMinutes: Number.parseInt(
        process.env.AUTH_RESET_TOKEN_EXPIRES_MINUTES ?? '15',
        10,
      ),
      allowDevOtpOutput: parseBoolean(
        process.env.AUTH_ALLOW_DEV_OTP_OUTPUT,
        nodeEnv === 'development' || nodeEnv === 'test',
      ),
      newDeviceAutoApprove: parseBoolean(
        process.env.AUTH_NEW_DEVICE_AUTO_APPROVE,
        nodeEnv === 'development' || nodeEnv === 'test',
      ),
      // Dashboard browsers should not lock out the first admin.
      webDeviceAutoApprove: parseBoolean(
        process.env.AUTH_WEB_DEVICE_AUTO_APPROVE,
        true,
      ),
      // Strict 1-installation → 1-account binding (production/staging only by default).
      enforceDeviceOwnership: parseBoolean(
        process.env.AUTH_ENFORCE_DEVICE_OWNERSHIP,
        nodeEnv === 'production' || nodeEnv === 'staging',
      ),
      // Comma-separated installationIds allowed to switch accounts (dev phones only).
      deviceOwnershipBypassInstallationIds: parseCsvList(
        process.env.AUTH_DEVICE_OWNERSHIP_BYPASS_INSTALLATION_IDS,
      ),
      passwordHistoryCount: Number.parseInt(
        process.env.AUTH_PASSWORD_HISTORY_COUNT ?? '5',
        10,
      ),
      passwordMaxAgeDays: Number.parseInt(
        process.env.AUTH_PASSWORD_MAX_AGE_DAYS ?? '0',
        10,
      ),
      strictFingerprint: parseBoolean(
        process.env.AUTH_STRICT_FINGERPRINT,
        false,
      ),
    },
    cors: {
      origins: parseCorsOrigins(
        process.env.CORS_ORIGINS ??
          'http://localhost:3000,http://localhost:3001,http://localhost:5173',
      ),
    },
    rateLimit: {
      ttl: Number.parseInt(process.env.RATE_LIMIT_TTL ?? '60000', 10),
      limit: Number.parseInt(process.env.RATE_LIMIT_LIMIT ?? '100', 10),
    },
    storage: {
      provider: (process.env.STORAGE_PROVIDER ?? 'local') as StorageProvider,
      bucket: process.env.STORAGE_BUCKET ?? '',
      region: process.env.STORAGE_REGION ?? '',
      endpoint: process.env.STORAGE_ENDPOINT ?? '',
      accessKey: process.env.STORAGE_ACCESS_KEY ?? '',
      secretKey: process.env.STORAGE_SECRET_KEY ?? '',
      publicUrl: process.env.STORAGE_PUBLIC_URL ?? '',
      maxImageSizeBytes: Number.parseInt(
        process.env.MAX_IMAGE_SIZE_BYTES ?? '10485760',
        10,
      ),
      maxVideoSizeBytes: Number.parseInt(
        process.env.MAX_VIDEO_SIZE_BYTES ?? '104857600',
        10,
      ),
      signedUrlTtlSeconds: Number.parseInt(
        process.env.STORAGE_SIGNED_URL_TTL_SECONDS ?? '900',
        10,
      ),
      localRoot: process.env.STORAGE_LOCAL_ROOT ?? './storage',
    },
    shift: {
      maxDurationHours: Number.parseInt(
        process.env.SHIFT_MAX_DURATION_HOURS ?? '24',
        10,
      ),
    },
    attendance: {
      clockInEarlyMinutes: Number.parseInt(
        process.env.ATTENDANCE_CLOCK_IN_EARLY_MINUTES ?? '30',
        10,
      ),
      deviceTimeToleranceMinutes: Number.parseInt(
        process.env.ATTENDANCE_DEVICE_TIME_TOLERANCE_MINUTES ?? '10',
        10,
      ),
      idempotencyTtlSeconds: Number.parseInt(
        process.env.ATTENDANCE_IDEMPOTENCY_TTL_SECONDS ?? '86400',
        10,
      ),
      geofenceEnabled: parseBoolean(
        process.env.ATTENDANCE_GEOFENCE_ENABLED,
        nodeEnv === 'production' || nodeEnv === 'staging',
      ),
    },
    patrol: {
      deviceTimeToleranceMinutes: Number.parseInt(
        process.env.PATROL_DEVICE_TIME_TOLERANCE_MINUTES ?? '10',
        10,
      ),
      offlineReviewThresholdMinutes: Number.parseInt(
        process.env.PATROL_OFFLINE_REVIEW_THRESHOLD_MINUTES ?? '30',
        10,
      ),
      startEarlyMinutes: Number.parseInt(
        process.env.PATROL_START_EARLY_MINUTES ?? '15',
        10,
      ),
      startLateMinutes: Number.parseInt(
        process.env.PATROL_START_LATE_MINUTES ?? '30',
        10,
      ),
      maxCheckpointRadiusMeters: Number.parseInt(
        process.env.PATROL_MAX_CHECKPOINT_RADIUS_METERS ?? '1000',
        10,
      ),
      requireSequentialCheckpoints: parseBoolean(
        process.env.PATROL_REQUIRE_SEQUENTIAL_CHECKPOINTS,
        true,
      ),
      idempotencyTtlSeconds: Number.parseInt(
        process.env.PATROL_IDEMPOTENCY_TTL_SECONDS ?? '86400',
        10,
      ),
    },
    incident: {
      idempotencyTtlSeconds: Number.parseInt(
        process.env.INCIDENT_IDEMPOTENCY_TTL_SECONDS ?? '86400',
        10,
      ),
    },
    emergency: {
      idempotencyTtlSeconds: Number.parseInt(
        process.env.EMERGENCY_IDEMPOTENCY_TTL_SECONDS ?? '86400',
        10,
      ),
    },
    sync: {
      idempotencyTtlSeconds: Number.parseInt(
        process.env.SYNC_IDEMPOTENCY_TTL_SECONDS ?? '86400',
        10,
      ),
    },
    redis: {
      enabled: parseBoolean(process.env.REDIS_ENABLED, false),
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'guardtrak:',
    },
    queue: {
      enabled: parseBoolean(process.env.QUEUE_ENABLED, true),
      concurrency: Number.parseInt(process.env.QUEUE_CONCURRENCY ?? '2', 10),
    },
    push: {
      fcm: {
        enabled: parseBoolean(process.env.FCM_ENABLED, false),
        projectId: process.env.FCM_PROJECT_ID ?? '',
        clientEmail: process.env.FCM_CLIENT_EMAIL ?? '',
        privateKey: (process.env.FCM_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
      },
      apns: {
        enabled: parseBoolean(process.env.APNS_ENABLED, false),
        keyId: process.env.APNS_KEY_ID ?? '',
        teamId: process.env.APNS_TEAM_ID ?? '',
        bundleId: process.env.APNS_BUNDLE_ID ?? '',
        keyPath: process.env.APNS_KEY_PATH ?? '',
      },
    },
    email: {
      enabled: parseBoolean(process.env.EMAIL_ENABLED, false),
      provider: (process.env.EMAIL_PROVIDER ?? 'smtp') as EmailProviderName,
      smtpHost: process.env.SMTP_HOST ?? 'localhost',
      smtpPort: Number.parseInt(process.env.SMTP_PORT ?? '1025', 10),
      smtpUser: process.env.SMTP_USER ?? '',
      smtpPass: process.env.SMTP_PASS ?? '',
      smtpFrom: process.env.SMTP_FROM ?? 'noreply@folps.local',
      resendApiKey: process.env.EMAIL_RESEND_API_KEY ?? '',
      awsSesRegion: process.env.AWS_SES_REGION ?? '',
    },
    ws: {
      enabled: parseBoolean(process.env.WS_ENABLED, true),
      corsOrigins: parseCorsOrigins(
        process.env.WS_CORS_ORIGINS ??
          process.env.CORS_ORIGINS ??
          'http://localhost:3000,http://localhost:3001,http://localhost:5173',
      ),
    },
    observability: {
      metricsEnabled: parseBoolean(process.env.METRICS_ENABLED, true),
      trustProxy: parseBoolean(process.env.TRUST_PROXY, false),
      compressionEnabled: parseBoolean(process.env.COMPRESSION_ENABLED, true),
    },
  };
};
