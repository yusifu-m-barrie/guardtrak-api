export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  EMAILS: 'emails',
  EVIDENCE: 'evidence',
  THUMBNAILS: 'thumbnails',
  REPORTS: 'reports',
  CLEANUP: 'cleanup',
  SYNC_RETRIES: 'sync-retries',
  EXPIRED_UPLOADS: 'expired-uploads',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const REFRESH_TOKEN_CLEANUP_JOB = 'refresh-token-cleanup';
export const EXPIRED_SESSIONS_JOB = 'expired-sessions';
export const OTP_CLEANUP_JOB = 'otp-cleanup';
export const PASSWORD_RESET_CLEANUP_JOB = 'password-reset-cleanup';
export const INACTIVE_DEVICES_JOB = 'inactive-devices';
export const INCIDENT_ESCALATION_JOB = 'incident-escalation';
export const AUDIT_CLEANUP_JOB = 'audit-cleanup';
export const DATABASE_CLEANUP_JOB = 'database-cleanup';
export const NOTIFICATION_RETRY_JOB = 'notification-retry';
