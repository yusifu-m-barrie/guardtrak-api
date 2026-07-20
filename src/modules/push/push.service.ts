import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DevicePlatform,
  DeviceStatus,
  type Notification,
  Prisma,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  APNS_PUSH_PROVIDER,
  FCM_PUSH_PROVIDER,
  type PushProvider,
  type SendPushResult,
} from './push.types';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  silent?: boolean;
}

export interface DeliverNotificationResult {
  success: boolean;
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  failureReason?: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private sentCount = 0;
  private failedCount = 0;
  private skippedCount = 0;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FCM_PUSH_PROVIDER) private readonly fcmProvider: PushProvider,
    @Inject(APNS_PUSH_PROVIDER) private readonly apnsProvider: PushProvider,
  ) {}

  getAnalyticsCounters(): {
    sent: number;
    failed: number;
    skipped: number;
  } {
    return {
      sent: this.sentCount,
      failed: this.failedCount,
      skipped: this.skippedCount,
    };
  }

  async deliverNotification(
    notification: Notification,
  ): Promise<DeliverNotificationResult> {
    const data = this.notificationData(notification.data);
    return this.sendToUser(
      notification.recipientUserId,
      notification.organisationId,
      {
        title: notification.title,
        body: notification.body,
        data: {
          ...data,
          notificationId: notification.id,
          type: notification.type,
        },
      },
    );
  }

  async sendToUser(
    userId: string,
    orgId: string,
    payload: PushPayload,
  ): Promise<DeliverNotificationResult> {
    const tokens = await this.prisma.pushToken.findMany({
      where: {
        active: true,
        device: {
          userId,
          organisationId: orgId,
          status: DeviceStatus.ACTIVE,
        },
      },
      include: {
        device: {
          select: { platform: true },
        },
      },
    });

    if (tokens.length === 0) {
      this.skippedCount += 1;
      return {
        success: true,
        attempted: 0,
        sent: 0,
        failed: 0,
        skipped: 1,
      };
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let lastFailure: string | undefined;

    for (const row of tokens) {
      const provider = this.resolveProvider(row.device.platform);
      const result = await provider.send({
        token: row.token,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        silent: payload.silent,
      });
      await this.handleTokenResult(row.id, result);

      if (result.skipped) {
        skipped += 1;
        this.skippedCount += 1;
      } else if (result.success) {
        sent += 1;
        this.sentCount += 1;
      } else {
        failed += 1;
        this.failedCount += 1;
        lastFailure = result.failureReason;
      }
    }

    return {
      success: failed === 0,
      attempted: tokens.length,
      sent,
      failed,
      skipped,
      failureReason: lastFailure,
    };
  }

  private resolveProvider(platform: DevicePlatform): PushProvider {
    if (platform === DevicePlatform.IOS) {
      return this.apnsProvider;
    }
    return this.fcmProvider;
  }

  private async handleTokenResult(
    pushTokenId: string,
    result: SendPushResult,
  ): Promise<void> {
    if (result.inactive) {
      await this.prisma.pushToken.update({
        where: { id: pushTokenId },
        data: {
          active: false,
          invalidatedAt: new Date(),
        },
      });
    }
  }

  private notificationData(
    value: Prisma.JsonValue | null,
  ): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    const entries = Object.entries(value as Record<string, unknown>);
    const data: Record<string, string> = {};
    for (const [key, entryValue] of entries) {
      if (entryValue === null || entryValue === undefined) {
        continue;
      }
      if (
        typeof entryValue === 'string' ||
        typeof entryValue === 'number' ||
        typeof entryValue === 'boolean'
      ) {
        data[key] = String(entryValue);
      }
    }
    return data;
  }
}
