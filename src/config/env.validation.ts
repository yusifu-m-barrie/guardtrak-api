import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';
import { plainToInstance, Transform, Type } from 'class-transformer';
import type {
  EmailProviderName,
  NodeEnvironment,
  StorageProvider,
} from './config.types';

const PLACEHOLDER_SECRET_MARKERS = [
  'change-me',
  'changeme',
  'replace-me',
  'placeholder',
];

function isPlaceholderSecret(value: string | undefined): boolean {
  if (!value || value.trim().length === 0) {
    return true;
  }
  const normalised = value.toLowerCase();
  return PLACEHOLDER_SECRET_MARKERS.some((marker) =>
    normalised.includes(marker),
  );
}

const BOOLEAN_ENV_KEYS = [
  'AUTH_ALLOW_DEV_OTP_OUTPUT',
  'AUTH_NEW_DEVICE_AUTO_APPROVE',
  'AUTH_STRICT_FINGERPRINT',
  'ATTENDANCE_GEOFENCE_ENABLED',
  'REDIS_ENABLED',
  'QUEUE_ENABLED',
  'FCM_ENABLED',
  'APNS_ENABLED',
  'EMAIL_ENABLED',
  'WS_ENABLED',
  'METRICS_ENABLED',
  'TRUST_PROXY',
  'COMPRESSION_ENABLED',
  'ENABLE_SWAGGER',
  'STORAGE_ALLOW_EPHEMERAL',
] as const;

/**
 * class-transformer `enableImplicitConversion` treats any non-empty string as
 * truthy for boolean design:types, so `"false"` becomes `true`. Coerce env
 * strings before plainToInstance so Railway/production values work.
 */
function parseEnvBooleanString(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalised)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalised)) {
      return false;
    }
  }
  return undefined;
}

function coerceEnvBooleans(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...config };
  for (const key of BOOLEAN_ENV_KEYS) {
    if (!(key in next)) {
      continue;
    }
    const parsed = parseEnvBooleanString(next[key]);
    if (parsed !== undefined) {
      next[key] = parsed;
    }
  }
  return next;
}

function optionalBooleanTransform({
  value,
}: {
  value: unknown;
}): boolean | undefined {
  return parseEnvBooleanString(value);
}

function booleanWithDefault(defaultValue: boolean) {
  return ({ value }: { value: unknown }): boolean => {
    const parsed = parseEnvBooleanString(value);
    return parsed === undefined ? defaultValue : parsed;
  };
}

export class EnvironmentVariables {
  @IsIn(['development', 'staging', 'production', 'test'])
  NODE_ENV: NodeEnvironment = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  API_PREFIX = 'api/v1';

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN = '15m';

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN = '30d';

  @IsString()
  @IsNotEmpty()
  JWT_ISSUER = 'guardtrak-api';

  @IsString()
  @IsNotEmpty()
  JWT_AUDIENCE = 'guardtrak-clients';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_MAX_FAILED_ATTEMPTS = 5;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_LOCKOUT_MINUTES = 15;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_PASSWORD_RESET_OTP_EXPIRES_MINUTES = 10;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_PASSWORD_RESET_MAX_ATTEMPTS = 5;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_RESET_TOKEN_EXPIRES_MINUTES = 15;

  @IsOptional()
  @Transform(optionalBooleanTransform)
  AUTH_ALLOW_DEV_OTP_OUTPUT?: boolean;

  @IsOptional()
  @Transform(optionalBooleanTransform)
  AUTH_NEW_DEVICE_AUTO_APPROVE?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  AUTH_PASSWORD_HISTORY_COUNT = 5;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  AUTH_PASSWORD_MAX_AGE_DAYS = 0;

  @Transform(booleanWithDefault(false))
  AUTH_STRICT_FINGERPRINT = false;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS =
    'http://localhost:3000,http://localhost:3001,http://localhost:5173';

  @IsString()
  @IsNotEmpty()
  LOG_LEVEL = 'log';

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  RATE_LIMIT_TTL = 60_000;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  RATE_LIMIT_LIMIT = 100;

  @IsIn(['local', 's3', 'minio', 'r2'])
  STORAGE_PROVIDER: StorageProvider = 'local';

  /** Explicit opt-in for ephemeral local disk in staging/production demos only. */
  @IsOptional()
  @Transform(optionalBooleanTransform)
  STORAGE_ALLOW_EPHEMERAL?: boolean;

  @IsOptional()
  @IsString()
  STORAGE_BUCKET = '';

  @IsOptional()
  @IsString()
  STORAGE_REGION = '';

  @IsOptional()
  @IsString()
  STORAGE_ENDPOINT = '';

  @IsOptional()
  @IsString()
  STORAGE_ACCESS_KEY = '';

  @IsOptional()
  @IsString()
  STORAGE_SECRET_KEY = '';

  @IsOptional()
  @IsString()
  STORAGE_PUBLIC_URL = '';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  MAX_IMAGE_SIZE_BYTES = 10_485_760;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  MAX_VIDEO_SIZE_BYTES = 104_857_600;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(72)
  SHIFT_MAX_DURATION_HOURS = 24;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  ATTENDANCE_CLOCK_IN_EARLY_MINUTES = 30;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  ATTENDANCE_DEVICE_TIME_TOLERANCE_MINUTES = 10;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  ATTENDANCE_IDEMPOTENCY_TTL_SECONDS = 86_400;

  @IsOptional()
  @Transform(optionalBooleanTransform)
  ATTENDANCE_GEOFENCE_ENABLED?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  PATROL_DEVICE_TIME_TOLERANCE_MINUTES = 10;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  PATROL_OFFLINE_REVIEW_THRESHOLD_MINUTES = 30;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  PATROL_START_EARLY_MINUTES = 15;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  PATROL_START_LATE_MINUTES = 30;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  PATROL_MAX_CHECKPOINT_RADIUS_METERS = 1000;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') {
      return true;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    }
    return Boolean(value);
  })
  PATROL_REQUIRE_SEQUENTIAL_CHECKPOINTS = true;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  PATROL_IDEMPOTENCY_TTL_SECONDS = 86_400;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  INCIDENT_IDEMPOTENCY_TTL_SECONDS = 86_400;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  EMERGENCY_IDEMPOTENCY_TTL_SECONDS = 86_400;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  SYNC_IDEMPOTENCY_TTL_SECONDS = 86_400;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(86_400)
  STORAGE_SIGNED_URL_TTL_SECONDS = 900;

  @IsOptional()
  @IsString()
  STORAGE_LOCAL_ROOT = './storage';

  @IsOptional()
  @Transform(optionalBooleanTransform)
  ENABLE_SWAGGER?: boolean;

  @Transform(booleanWithDefault(false))
  REDIS_ENABLED = false;

  @IsOptional()
  @IsString()
  REDIS_URL = 'redis://localhost:6379';

  @IsOptional()
  @IsString()
  REDIS_KEY_PREFIX = 'guardtrak:';

  @Transform(booleanWithDefault(true))
  QUEUE_ENABLED = true;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(64)
  QUEUE_CONCURRENCY = 2;

  @Transform(booleanWithDefault(false))
  FCM_ENABLED = false;

  @IsOptional()
  @IsString()
  FCM_PROJECT_ID = '';

  @IsOptional()
  @IsString()
  FCM_CLIENT_EMAIL = '';

  @IsOptional()
  @IsString()
  FCM_PRIVATE_KEY = '';

  @Transform(booleanWithDefault(false))
  APNS_ENABLED = false;

  @IsOptional()
  @IsString()
  APNS_KEY_ID = '';

  @IsOptional()
  @IsString()
  APNS_TEAM_ID = '';

  @IsOptional()
  @IsString()
  APNS_BUNDLE_ID = '';

  @IsOptional()
  @IsString()
  APNS_KEY_PATH = '';

  @Transform(booleanWithDefault(false))
  EMAIL_ENABLED = false;

  @IsIn(['smtp', 'resend', 'ses'])
  EMAIL_PROVIDER: EmailProviderName = 'smtp';

  @IsOptional()
  @IsString()
  SMTP_HOST = 'localhost';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT = 1025;

  @IsOptional()
  @IsString()
  SMTP_USER = '';

  @IsOptional()
  @IsString()
  SMTP_PASS = '';

  @IsOptional()
  @IsString()
  SMTP_FROM = 'noreply@folps.local';

  @IsOptional()
  @IsString()
  EMAIL_RESEND_API_KEY = '';

  @IsOptional()
  @IsString()
  AWS_SES_REGION = '';

  @Transform(booleanWithDefault(true))
  WS_ENABLED = true;

  @IsOptional()
  @IsString()
  WS_CORS_ORIGINS =
    'http://localhost:3000,http://localhost:3001,http://localhost:5173';

  @Transform(booleanWithDefault(true))
  METRICS_ENABLED = true;

  @IsOptional()
  @Transform(optionalBooleanTransform)
  TRUST_PROXY?: boolean;

  @Transform(booleanWithDefault(true))
  COMPRESSION_ENABLED = true;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(
    EnvironmentVariables,
    coerceEnvBooleans(config),
    {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    },
  );

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: true,
    forbidNonWhitelisted: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join(', ')
          : 'invalid';
        return `${error.property}: ${constraints}`;
      })
      .join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  const nodeEnv = validated.NODE_ENV;
  const isProduction = nodeEnv === 'production';
  const isStaging = nodeEnv === 'staging';

  if (!validated.DATABASE_URL?.trim()) {
    throw new Error('Environment validation failed: DATABASE_URL is required');
  }

  if (isProduction || isStaging) {
    if (isPlaceholderSecret(validated.JWT_ACCESS_SECRET)) {
      throw new Error(
        'Environment validation failed: JWT_ACCESS_SECRET must be set to a non-placeholder value in staging/production',
      );
    }
    if (isPlaceholderSecret(validated.JWT_REFRESH_SECRET)) {
      throw new Error(
        'Environment validation failed: JWT_REFRESH_SECRET must be set to a non-placeholder value in staging/production',
      );
    }
    if (
      validated.STORAGE_PROVIDER !== 'local' &&
      (!validated.STORAGE_BUCKET ||
        !validated.STORAGE_ACCESS_KEY ||
        !validated.STORAGE_SECRET_KEY)
    ) {
      throw new Error(
        'Environment validation failed: storage credentials are required when STORAGE_PROVIDER is not local',
      );
    }
    if (
      validated.STORAGE_PROVIDER === 'local' &&
      validated.STORAGE_ALLOW_EPHEMERAL !== true
    ) {
      throw new Error(
        'Environment validation failed: STORAGE_PROVIDER=local is not allowed in staging/production (Railway disk is ephemeral). Use s3/r2, or set STORAGE_ALLOW_EPHEMERAL=true only for temporary demos',
      );
    }
    if (validated.TRUST_PROXY !== true) {
      throw new Error(
        'Environment validation failed: TRUST_PROXY must be true in staging/production (required behind Railway/Nginx)',
      );
    }
    if (validated.AUTH_ALLOW_DEV_OTP_OUTPUT === true) {
      throw new Error(
        'Environment validation failed: AUTH_ALLOW_DEV_OTP_OUTPUT must be disabled in staging/production',
      );
    }
    if (validated.AUTH_NEW_DEVICE_AUTO_APPROVE === true) {
      throw new Error(
        'Environment validation failed: AUTH_NEW_DEVICE_AUTO_APPROVE must be disabled in staging/production',
      );
    }
  }

  if (nodeEnv === 'development' || nodeEnv === 'test') {
    if (!validated.JWT_ACCESS_SECRET) {
      validated.JWT_ACCESS_SECRET = 'dev-access-secret-change-me';
    }
    if (!validated.JWT_REFRESH_SECRET) {
      validated.JWT_REFRESH_SECRET = 'dev-refresh-secret-change-me';
    }
  }

  return validated;
}

export function applyDevelopmentDefaults(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv =
    typeof config.NODE_ENV === 'string' ? config.NODE_ENV : 'development';
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    return config;
  }

  return {
    ...config,
    NODE_ENV: config.NODE_ENV ?? 'development',
    PORT: config.PORT ?? '3000',
    API_PREFIX: config.API_PREFIX ?? 'api/v1',
    JWT_ACCESS_SECRET:
      config.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    JWT_REFRESH_SECRET:
      config.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    JWT_ACCESS_EXPIRES_IN: config.JWT_ACCESS_EXPIRES_IN ?? '15m',
    JWT_REFRESH_EXPIRES_IN: config.JWT_REFRESH_EXPIRES_IN ?? '30d',
    JWT_ISSUER: config.JWT_ISSUER ?? 'guardtrak-api',
    JWT_AUDIENCE: config.JWT_AUDIENCE ?? 'guardtrak-clients',
    AUTH_MAX_FAILED_ATTEMPTS: config.AUTH_MAX_FAILED_ATTEMPTS ?? '5',
    AUTH_LOCKOUT_MINUTES: config.AUTH_LOCKOUT_MINUTES ?? '15',
    AUTH_PASSWORD_RESET_OTP_EXPIRES_MINUTES:
      config.AUTH_PASSWORD_RESET_OTP_EXPIRES_MINUTES ?? '10',
    AUTH_PASSWORD_RESET_MAX_ATTEMPTS:
      config.AUTH_PASSWORD_RESET_MAX_ATTEMPTS ?? '5',
    AUTH_RESET_TOKEN_EXPIRES_MINUTES:
      config.AUTH_RESET_TOKEN_EXPIRES_MINUTES ?? '15',
    AUTH_ALLOW_DEV_OTP_OUTPUT: config.AUTH_ALLOW_DEV_OTP_OUTPUT ?? 'true',
    AUTH_NEW_DEVICE_AUTO_APPROVE: config.AUTH_NEW_DEVICE_AUTO_APPROVE ?? 'true',
    AUTH_PASSWORD_HISTORY_COUNT: config.AUTH_PASSWORD_HISTORY_COUNT ?? '5',
    AUTH_PASSWORD_MAX_AGE_DAYS: config.AUTH_PASSWORD_MAX_AGE_DAYS ?? '0',
    AUTH_STRICT_FINGERPRINT: config.AUTH_STRICT_FINGERPRINT ?? 'false',
    CORS_ORIGINS:
      config.CORS_ORIGINS ??
      'http://localhost:3000,http://localhost:3001,http://localhost:5173',
    LOG_LEVEL: config.LOG_LEVEL ?? 'log',
    RATE_LIMIT_TTL: config.RATE_LIMIT_TTL ?? '60000',
    RATE_LIMIT_LIMIT: config.RATE_LIMIT_LIMIT ?? '100',
    STORAGE_PROVIDER: config.STORAGE_PROVIDER ?? 'local',
    MAX_IMAGE_SIZE_BYTES: config.MAX_IMAGE_SIZE_BYTES ?? '10485760',
    MAX_VIDEO_SIZE_BYTES: config.MAX_VIDEO_SIZE_BYTES ?? '104857600',
    ATTENDANCE_GEOFENCE_ENABLED: config.ATTENDANCE_GEOFENCE_ENABLED ?? 'false',
    REDIS_ENABLED: config.REDIS_ENABLED ?? 'false',
    REDIS_URL: config.REDIS_URL ?? 'redis://localhost:6379',
    REDIS_KEY_PREFIX: config.REDIS_KEY_PREFIX ?? 'guardtrak:',
    QUEUE_ENABLED: config.QUEUE_ENABLED ?? 'true',
    QUEUE_CONCURRENCY: config.QUEUE_CONCURRENCY ?? '2',
    FCM_ENABLED: config.FCM_ENABLED ?? 'false',
    APNS_ENABLED: config.APNS_ENABLED ?? 'false',
    EMAIL_ENABLED: config.EMAIL_ENABLED ?? 'false',
    EMAIL_PROVIDER: config.EMAIL_PROVIDER ?? 'smtp',
    SMTP_HOST: config.SMTP_HOST ?? 'localhost',
    SMTP_PORT: config.SMTP_PORT ?? '1025',
    SMTP_FROM: config.SMTP_FROM ?? 'noreply@folps.local',
    WS_ENABLED: config.WS_ENABLED ?? 'true',
    WS_CORS_ORIGINS:
      config.WS_CORS_ORIGINS ??
      'http://localhost:3000,http://localhost:3001,http://localhost:5173',
    METRICS_ENABLED: config.METRICS_ENABLED ?? 'true',
    TRUST_PROXY: config.TRUST_PROXY ?? 'false',
    COMPRESSION_ENABLED: config.COMPRESSION_ENABLED ?? 'true',
  };
}
