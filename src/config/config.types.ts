export type NodeEnvironment = 'development' | 'staging' | 'production' | 'test';

export type StorageProvider = 'local' | 's3' | 'minio' | 'r2';

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  port: number;
  apiPrefix: string;
  logLevel: string;
  enableSwagger: boolean;
}

export interface DatabaseConfig {
  url: string;
}

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
  issuer: string;
  audience: string;
}

export interface AuthConfig {
  maxFailedAttempts: number;
  lockoutMinutes: number;
  passwordResetOtpExpiresMinutes: number;
  passwordResetMaxAttempts: number;
  resetTokenExpiresMinutes: number;
  allowDevOtpOutput: boolean;
  newDeviceAutoApprove: boolean;
  /** Auto-activate dashboard browsers (WEB). Defaults to true. */
  webDeviceAutoApprove: boolean;
  /** When true, reject login if installationId belongs to another user. */
  enforceDeviceOwnership: boolean;
  passwordHistoryCount: number;
  passwordMaxAgeDays: number;
  strictFingerprint: boolean;
}

export interface CorsConfig {
  origins: string[];
}

export interface RateLimitConfig {
  ttl: number;
  limit: number;
}

export interface StorageConfig {
  provider: StorageProvider;
  bucket: string;
  region: string;
  endpoint: string;
  accessKey: string;
  secretKey: string;
  publicUrl: string;
  maxImageSizeBytes: number;
  maxVideoSizeBytes: number;
  signedUrlTtlSeconds: number;
  localRoot: string;
}

export interface IncidentConfig {
  idempotencyTtlSeconds: number;
}

export interface EmergencyConfig {
  idempotencyTtlSeconds: number;
}

export interface SyncConfig {
  idempotencyTtlSeconds: number;
}

export interface RedisConfig {
  enabled: boolean;
  url: string;
  keyPrefix: string;
}

export interface QueueConfig {
  enabled: boolean;
  concurrency: number;
}

export interface FcmConfig {
  enabled: boolean;
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export interface ApnsConfig {
  enabled: boolean;
  keyId: string;
  teamId: string;
  bundleId: string;
  keyPath: string;
}

export interface PushConfig {
  fcm: FcmConfig;
  apns: ApnsConfig;
}

export type EmailProviderName = 'smtp' | 'resend' | 'ses';

export interface EmailConfig {
  enabled: boolean;
  provider: EmailProviderName;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  resendApiKey: string;
  awsSesRegion: string;
}

export interface WsConfig {
  enabled: boolean;
  corsOrigins: string[];
}

export interface ObservabilityConfig {
  metricsEnabled: boolean;
  trustProxy: boolean;
  compressionEnabled: boolean;
}

export interface ShiftConfig {
  maxDurationHours: number;
}

export interface AttendanceConfig {
  clockInEarlyMinutes: number;
  deviceTimeToleranceMinutes: number;
  idempotencyTtlSeconds: number;
}

export interface PatrolConfig {
  deviceTimeToleranceMinutes: number;
  offlineReviewThresholdMinutes: number;
  startEarlyMinutes: number;
  startLateMinutes: number;
  maxCheckpointRadiusMeters: number;
  requireSequentialCheckpoints: boolean;
  idempotencyTtlSeconds: number;
}

export interface GuardTrakConfig {
  app: AppConfig;
  database: DatabaseConfig;
  jwt: JwtConfig;
  auth: AuthConfig;
  cors: CorsConfig;
  rateLimit: RateLimitConfig;
  storage: StorageConfig;
  shift: ShiftConfig;
  attendance: AttendanceConfig;
  patrol: PatrolConfig;
  incident: IncidentConfig;
  emergency: EmergencyConfig;
  sync: SyncConfig;
  redis: RedisConfig;
  queue: QueueConfig;
  push: PushConfig;
  email: EmailConfig;
  ws: WsConfig;
  observability: ObservabilityConfig;
}
