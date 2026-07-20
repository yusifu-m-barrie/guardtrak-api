import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DeviceStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { EmailService } from '../../modules/email/email.service';
import { PushService } from '../../modules/push/push.service';
import {
  THUMBNAIL_HOOK,
  type ThumbnailHook,
} from '../../modules/storage/hooks/thumbnail.hook';
import {
  VIRUS_SCAN_HOOK,
  type VirusScanHook,
} from '../../modules/storage/hooks/virus-scan.hook';
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
import type { JobPayload, JobProcessor } from './queue.types';

@Injectable()
export class QueueJobProcessor implements JobProcessor {
  private readonly logger = new Logger(QueueJobProcessor.name);

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly prisma: PrismaService,
  ) {}

  async process(
    queueName: QueueName,
    jobName: string,
    data: JobPayload,
  ): Promise<void> {
    this.logger.log(
      `Processing job ${queueName}/${jobName}: ${JSON.stringify(data)}`,
    );

    if (queueName === QUEUE_NAMES.EMAILS) {
      await this.tryProcessEmail(jobName, data);
      return;
    }

    if (queueName === QUEUE_NAMES.NOTIFICATIONS) {
      if (jobName === NOTIFICATION_RETRY_JOB || jobName === 'retry') {
        await this.tryProcessNotification(data);
        return;
      }
      await this.tryProcessNotification(data);
      return;
    }

    if (queueName === QUEUE_NAMES.CLEANUP) {
      await this.processCleanup(jobName, data);
      return;
    }

    if (
      queueName === QUEUE_NAMES.EVIDENCE ||
      queueName === QUEUE_NAMES.THUMBNAILS
    ) {
      await this.processEvidenceOrThumbnail(queueName, jobName, data);
      return;
    }

    this.logger.debug(`Stub completed for ${queueName}/${jobName}`);
  }

  private async processCleanup(
    jobName: string,
    data: JobPayload,
  ): Promise<void> {
    const now = new Date();

    if (
      jobName === REFRESH_TOKEN_CLEANUP_JOB ||
      jobName === EXPIRED_SESSIONS_JOB
    ) {
      const result = await this.prisma.refreshSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            {
              revokedAt: {
                lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          ],
        },
      });
      this.logger.log(`Expired sessions cleanup removed ${result.count}`);
      return;
    }

    if (jobName === OTP_CLEANUP_JOB || jobName === PASSWORD_RESET_CLEANUP_JOB) {
      const result = await this.prisma.passwordResetToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { consumedAt: { not: null } }],
        },
      });
      this.logger.log(`Password reset/OTP cleanup removed ${result.count}`);
      return;
    }

    if (jobName === INACTIVE_DEVICES_JOB) {
      const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const result = await this.prisma.device.updateMany({
        where: {
          status: DeviceStatus.PENDING,
          createdAt: { lt: cutoff },
        },
        data: {
          status: DeviceStatus.REVOKED,
          revokedAt: now,
          trustScore: 0,
        },
      });
      this.logger.log(`Inactive devices revoked: ${result.count}`);
      return;
    }

    if (jobName === INCIDENT_ESCALATION_JOB) {
      this.logger.log('Incident escalation placeholder executed');
      void data;
      return;
    }

    if (jobName === AUDIT_CLEANUP_JOB || jobName === DATABASE_CLEANUP_JOB) {
      this.logger.log(`${jobName} placeholder executed`);
      return;
    }

    if (jobName === 'retry-dlq') {
      this.logger.log('DLQ retry placeholder executed');
      return;
    }

    this.logger.debug(`Cleanup stub completed for ${jobName}`);
  }

  private async processEvidenceOrThumbnail(
    queueName: QueueName,
    jobName: string,
    data: JobPayload,
  ): Promise<void> {
    const storageKey =
      typeof data.storageKey === 'string' ? data.storageKey : undefined;
    if (!storageKey) {
      this.logger.warn(
        `Evidence/thumbnail job ${queueName}/${jobName} missing storageKey`,
      );
      return;
    }

    if (queueName === QUEUE_NAMES.EVIDENCE) {
      const virusScan = this.resolveHook<VirusScanHook>(VIRUS_SCAN_HOOK);
      if (virusScan) {
        await virusScan.scan(storageKey);
      }
      this.logger.debug(`Evidence process completed for ${storageKey}`);
      return;
    }

    const mimeType =
      typeof data.mimeType === 'string'
        ? data.mimeType
        : 'application/octet-stream';
    const thumbnail = this.resolveHook<ThumbnailHook>(THUMBNAIL_HOOK);
    if (thumbnail) {
      await thumbnail.generate(storageKey, mimeType);
    }
    this.logger.debug(`Thumbnail generation completed for ${storageKey}`);
  }

  private resolveHook<T>(token: symbol): T | null {
    try {
      return this.moduleRef.get(token, { strict: false });
    } catch {
      return null;
    }
  }

  private async tryProcessEmail(
    jobName: string,
    data: JobPayload,
  ): Promise<void> {
    const emailService = this.moduleRef.get(EmailService, { strict: false });
    if (!emailService) {
      this.logger.warn(`EmailService unavailable for job ${jobName}`);
      return;
    }

    const to = typeof data.to === 'string' ? data.to : undefined;
    if (!to) {
      this.logger.warn(`Email job ${jobName} missing "to" field`);
      return;
    }

    if (jobName === 'password-reset' && typeof data.otp === 'string') {
      await emailService.sendPasswordReset({
        to,
        otp: data.otp,
        locale: typeof data.locale === 'string' ? data.locale : undefined,
      });
      return;
    }

    if (jobName === 'welcome' && typeof data.displayName === 'string') {
      await emailService.sendWelcome({
        to,
        displayName: data.displayName,
        locale: typeof data.locale === 'string' ? data.locale : undefined,
      });
    }
  }

  private async tryProcessNotification(data: JobPayload): Promise<void> {
    const pushService = this.moduleRef.get(PushService, { strict: false });
    if (!pushService) {
      this.logger.warn('PushService unavailable for notification job');
      return;
    }

    const userId = typeof data.userId === 'string' ? data.userId : undefined;
    const organisationId =
      typeof data.organisationId === 'string' ? data.organisationId : undefined;
    const title = typeof data.title === 'string' ? data.title : undefined;
    const body = typeof data.body === 'string' ? data.body : undefined;

    if (!userId || !organisationId || !title || !body) {
      this.logger.warn('Notification job missing required fields');
      return;
    }

    const payloadData =
      data.data && typeof data.data === 'object' && !Array.isArray(data.data)
        ? (data.data as Record<string, string>)
        : undefined;

    await pushService.sendToUser(userId, organisationId, {
      title,
      body,
      data: payloadData,
      silent: data.silent === true,
    });
  }
}
