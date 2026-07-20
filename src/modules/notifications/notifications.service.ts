import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AccountStatus,
  AuditAction,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationPriority,
  NotificationType,
  Prisma,
} from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { buildPaginationMeta } from '../../common/dto/pagination-meta.dto';
import type { RequestUser } from '../../common/types/request-user.type';
import {
  requireOrganisationId,
  tenantNotFound,
} from '../../common/tenant/tenant.util';
import { normalisePagination } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import { PushService } from '../push/push.service';
import type { ServiceRequestContext } from '../clients/clients.types';
import type { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import type { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import type { RegisterPushTokenDto } from './dto/register-push-token.dto';
import type { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import {
  toNotificationPreferenceResponse,
  toNotificationResponse,
} from './mappers/notification.mapper';

export interface CreateNotificationInput {
  organisationId: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  priority?: NotificationPriority;
  data?: Prisma.InputJsonValue;
  actorUserId?: string | null;
  requestId?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuthAuditService,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly pushService?: PushService,
  ) {}

  async createAndDeliver(input: CreateNotificationInput) {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId: input.recipientUserId },
    });
    const inAppEnabled = preference?.inAppEnabled ?? true;
    const pushEnabled = preference?.pushEnabled ?? true;
    const critical =
      (input.priority ?? NotificationPriority.NORMAL) ===
        NotificationPriority.CRITICAL ||
      input.type === NotificationType.SOS_ALERT;

    const notification = await this.prisma.notification.create({
      data: {
        organisationId: input.organisationId,
        recipientUserId: input.recipientUserId,
        type: input.type,
        priority: input.priority ?? NotificationPriority.NORMAL,
        title: input.title,
        body: input.body,
        data: input.data ?? Prisma.JsonNull,
      },
    });

    if (inAppEnabled || (critical && preference?.criticalAlertsAlwaysEnabled)) {
      await this.prisma.notificationDelivery.create({
        data: {
          notificationId: notification.id,
          channel: NotificationChannel.IN_APP,
          status: NotificationDeliveryStatus.SENT,
          queuedAt: new Date(),
          sentAt: new Date(),
          attempts: 1,
        },
      });
    }

    if (pushEnabled || (critical && preference?.criticalAlertsAlwaysEnabled)) {
      await this.prisma.notificationDelivery.create({
        data: {
          notificationId: notification.id,
          channel: NotificationChannel.PUSH,
          status: NotificationDeliveryStatus.QUEUED,
          queuedAt: new Date(),
          attempts: 0,
        },
      });
      void this.deliverPushNotification(notification);
    }

    this.eventEmitter.emit('notification.received', {
      organisationId: input.organisationId,
      notificationId: notification.id,
      recipientUserId: input.recipientUserId,
    });

    await this.auditService.record({
      organisationId: input.organisationId,
      actorUserId: input.actorUserId ?? null,
      action: AuditAction.CREATE,
      entityType: 'Notification',
      entityId: notification.id,
      requestId: input.requestId ?? null,
      metadata: {
        type: input.type,
        recipientUserId: input.recipientUserId,
      },
    });

    return toNotificationResponse(notification);
  }

  async notifyUsers(
    organisationId: string,
    userIds: string[],
    payload: Omit<
      CreateNotificationInput,
      'organisationId' | 'recipientUserId'
    >,
  ) {
    const unique = [...new Set(userIds)];
    const results = [];
    for (const recipientUserId of unique) {
      results.push(
        await this.createAndDeliver({
          ...payload,
          organisationId,
          recipientUserId,
        }),
      );
    }
    return results;
  }

  async listMine(user: RequestUser, query: ListNotificationsQueryDto) {
    const organisationId = requireOrganisationId(user);
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const where: Prisma.NotificationWhereInput = {
      organisationId,
      recipientUserId: user.id,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return {
      data: rows.map(toNotificationResponse),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async unreadCount(user: RequestUser) {
    const organisationId = requireOrganisationId(user);
    const count = await this.prisma.notification.count({
      where: {
        organisationId,
        recipientUserId: user.id,
        readAt: null,
      },
    });
    return { unreadCount: count };
  }

  async markRead(user: RequestUser, id: string) {
    const organisationId = requireOrganisationId(user);
    const row = await this.prisma.notification.findFirst({
      where: { id, organisationId, recipientUserId: user.id },
    });
    if (!row) {
      tenantNotFound(ErrorCode.NOTIFICATION_NOT_FOUND);
    }
    if (row.readAt) {
      return toNotificationResponse(row);
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return toNotificationResponse(updated);
  }

  async markAllRead(user: RequestUser) {
    const organisationId = requireOrganisationId(user);
    const result = await this.prisma.notification.updateMany({
      where: {
        organisationId,
        recipientUserId: user.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { updatedCount: result.count };
  }

  async getPreferences(user: RequestUser) {
    const prefs = await this.prisma.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
    return toNotificationPreferenceResponse(prefs);
  }

  async updatePreferences(
    user: RequestUser,
    dto: UpdateNotificationPreferencesDto,
  ) {
    const prefs = await this.prisma.notificationPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        inAppEnabled: dto.inAppEnabled ?? true,
        pushEnabled: dto.pushEnabled ?? true,
        smsEnabled: dto.smsEnabled ?? false,
        emailEnabled: dto.emailEnabled ?? true,
        quietHoursEnabled: dto.quietHoursEnabled ?? false,
        quietHoursStart: dto.quietHoursStart ?? null,
        quietHoursEnd: dto.quietHoursEnd ?? null,
        criticalAlertsAlwaysEnabled: dto.criticalAlertsAlwaysEnabled ?? true,
      },
      update: {
        ...(dto.inAppEnabled !== undefined
          ? { inAppEnabled: dto.inAppEnabled }
          : {}),
        ...(dto.pushEnabled !== undefined
          ? { pushEnabled: dto.pushEnabled }
          : {}),
        ...(dto.smsEnabled !== undefined ? { smsEnabled: dto.smsEnabled } : {}),
        ...(dto.emailEnabled !== undefined
          ? { emailEnabled: dto.emailEnabled }
          : {}),
        ...(dto.quietHoursEnabled !== undefined
          ? { quietHoursEnabled: dto.quietHoursEnabled }
          : {}),
        ...(dto.quietHoursStart !== undefined
          ? { quietHoursStart: dto.quietHoursStart }
          : {}),
        ...(dto.quietHoursEnd !== undefined
          ? { quietHoursEnd: dto.quietHoursEnd }
          : {}),
        ...(dto.criticalAlertsAlwaysEnabled !== undefined
          ? { criticalAlertsAlwaysEnabled: dto.criticalAlertsAlwaysEnabled }
          : {}),
      },
    });
    return toNotificationPreferenceResponse(prefs);
  }

  async registerPushToken(user: RequestUser, dto: RegisterPushTokenDto) {
    const organisationId = requireOrganisationId(user);
    const device = await this.prisma.device.findFirst({
      where: {
        organisationId,
        userId: user.id,
        installationId: dto.installationId,
      },
    });
    if (!device) {
      tenantNotFound(ErrorCode.DEVICE_NOT_FOUND);
    }
    const token = await this.prisma.pushToken.upsert({
      where: {
        deviceId_token: {
          deviceId: device.id,
          token: dto.token,
        },
      },
      create: {
        deviceId: device.id,
        token: dto.token,
        provider: dto.provider ?? 'fcm',
        active: true,
        lastRegisteredAt: new Date(),
      },
      update: {
        active: true,
        provider: dto.provider ?? 'fcm',
        lastRegisteredAt: new Date(),
        invalidatedAt: null,
      },
    });
    return {
      id: token.id,
      deviceId: token.deviceId,
      provider: token.provider,
      active: token.active,
      lastRegisteredAt: token.lastRegisteredAt.toISOString(),
    };
  }

  async broadcast(
    user: RequestUser,
    dto: BroadcastNotificationDto,
    ctx: ServiceRequestContext,
  ) {
    const organisationId = requireOrganisationId(user);
    let recipientIds = dto.recipientUserIds ?? [];
    if (recipientIds.length === 0) {
      const users = await this.prisma.user.findMany({
        where: {
          organisationId,
          status: AccountStatus.ACTIVE,
          deletedAt: null,
        },
        select: { id: true },
      });
      recipientIds = users.map((u) => u.id);
    }
    if (recipientIds.length === 0) {
      throw new AppException(
        'No recipients for broadcast',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    const created = await this.notifyUsers(organisationId, recipientIds, {
      type: NotificationType.BROADCAST,
      title: dto.title,
      body: dto.body,
      priority: dto.priority ?? NotificationPriority.NORMAL,
      actorUserId: user.id,
      requestId: ctx.requestId,
    });
    return { deliveredCount: created.length, notifications: created };
  }

  private deliverPushNotification(notification: {
    id: string;
    organisationId: string;
    recipientUserId: string;
    type: NotificationType;
    title: string;
    body: string;
    data: Prisma.JsonValue | null;
    priority: NotificationPriority;
    readAt: Date | null;
    createdAt: Date;
    expiresAt: Date | null;
  }): void {
    if (!this.pushService) {
      return;
    }
    void this.pushService
      .deliverNotification(notification)
      .then(async (result) => {
        await this.prisma.notificationDelivery.updateMany({
          where: {
            notificationId: notification.id,
            channel: NotificationChannel.PUSH,
          },
          data: {
            status: result.success
              ? NotificationDeliveryStatus.SENT
              : NotificationDeliveryStatus.FAILED,
            sentAt: result.success ? new Date() : null,
            failedAt: result.success ? null : new Date(),
            failureReason: result.failureReason ?? null,
            attempts: 1,
          },
        });
      })
      .catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        await this.prisma.notificationDelivery.updateMany({
          where: {
            notificationId: notification.id,
            channel: NotificationChannel.PUSH,
          },
          data: {
            status: NotificationDeliveryStatus.FAILED,
            failedAt: new Date(),
            failureReason: message,
            attempts: 1,
          },
        });
      });
  }
}
