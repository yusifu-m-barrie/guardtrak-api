import { Injectable } from '@nestjs/common';
import {
  AUDIT_CLEANUP_JOB,
  DATABASE_CLEANUP_JOB,
  EXPIRED_SESSIONS_JOB,
  INACTIVE_DEVICES_JOB,
  INCIDENT_ESCALATION_JOB,
  NOTIFICATION_RETRY_JOB,
  OTP_CLEANUP_JOB,
  PASSWORD_RESET_CLEANUP_JOB,
  QUEUE_NAMES,
  REFRESH_TOKEN_CLEANUP_JOB,
  type QueueName,
} from './queue.names';
import type {
  EnqueueResult,
  JobPayload,
  QueueBackend,
  QueueMetrics,
} from './queue.types';

@Injectable()
export class JobsService {
  private backend: QueueBackend | null = null;

  setBackend(backend: QueueBackend): void {
    this.backend = backend;
  }

  enqueueNotification(data: JobPayload): Promise<EnqueueResult> {
    return this.enqueue(QUEUE_NAMES.NOTIFICATIONS, 'send', data);
  }

  enqueueEmail(jobName: string, data: JobPayload): Promise<EnqueueResult> {
    return this.enqueue(QUEUE_NAMES.EMAILS, jobName, data);
  }

  enqueueEvidenceProcess(data: JobPayload): Promise<EnqueueResult> {
    return this.enqueue(QUEUE_NAMES.EVIDENCE, 'process', data);
  }

  enqueueThumbnail(data: JobPayload): Promise<EnqueueResult> {
    return this.enqueue(QUEUE_NAMES.THUMBNAILS, 'generate', data);
  }

  enqueueReport(data: JobPayload): Promise<EnqueueResult> {
    return this.enqueue(QUEUE_NAMES.REPORTS, 'generate', data);
  }

  enqueueCleanup(data: JobPayload): Promise<EnqueueResult> {
    return this.enqueue(QUEUE_NAMES.CLEANUP, 'run', data);
  }

  enqueueSyncRetry(data: JobPayload): Promise<EnqueueResult> {
    return this.enqueue(QUEUE_NAMES.SYNC_RETRIES, 'retry', data);
  }

  enqueueExpiredUploadCleanup(data: JobPayload): Promise<EnqueueResult> {
    return this.enqueue(QUEUE_NAMES.EXPIRED_UPLOADS, 'cleanup', data);
  }

  enqueueRefreshTokenCleanup(data: JobPayload = {}): Promise<EnqueueResult> {
    return this.enqueue(QUEUE_NAMES.CLEANUP, REFRESH_TOKEN_CLEANUP_JOB, data);
  }

  enqueueExpiredSessions(data: JobPayload = {}): Promise<EnqueueResult> {
    return this.enqueue(QUEUE_NAMES.CLEANUP, EXPIRED_SESSIONS_JOB, data);
  }

  enqueueOtpCleanup(data: JobPayload = {}): Promise<EnqueueResult> {
    return this.enqueue(QUEUE_NAMES.CLEANUP, OTP_CLEANUP_JOB, data);
  }

  enqueuePasswordResetCleanup(data: JobPayload = {}): Promise<EnqueueResult> {
    return this.enqueue(QUEUE_NAMES.CLEANUP, PASSWORD_RESET_CLEANUP_JOB, data);
  }

  enqueueInactiveDevicesCleanup(data: JobPayload = {}): Promise<EnqueueResult> {
    return this.enqueue(QUEUE_NAMES.CLEANUP, INACTIVE_DEVICES_JOB, data);
  }

  enqueueIncidentEscalation(data: JobPayload = {}): Promise<EnqueueResult> {
    return this.enqueue(QUEUE_NAMES.CLEANUP, INCIDENT_ESCALATION_JOB, data);
  }

  enqueueAuditCleanup(data: JobPayload = {}): Promise<EnqueueResult> {
    return this.enqueue(QUEUE_NAMES.CLEANUP, AUDIT_CLEANUP_JOB, data);
  }

  enqueueDatabaseCleanup(data: JobPayload = {}): Promise<EnqueueResult> {
    return this.enqueue(QUEUE_NAMES.CLEANUP, DATABASE_CLEANUP_JOB, data);
  }

  enqueueNotificationRetry(data: JobPayload): Promise<EnqueueResult> {
    return this.enqueue(
      QUEUE_NAMES.NOTIFICATIONS,
      NOTIFICATION_RETRY_JOB,
      data,
    );
  }

  getMetrics(): QueueMetrics {
    if (!this.backend) {
      return { backend: 'memory', queues: {} };
    }
    return this.backend.getMetrics();
  }

  private enqueue(
    queueName: QueueName,
    jobName: string,
    data: JobPayload,
  ): Promise<EnqueueResult> {
    if (!this.backend) {
      throw new Error('Queue backend is not initialized');
    }
    return this.backend.enqueue(queueName, jobName, data);
  }
}
