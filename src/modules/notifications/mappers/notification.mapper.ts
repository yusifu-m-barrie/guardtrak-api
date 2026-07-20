import type {
  Notification,
  NotificationPreference,
} from '../../../../generated/prisma/client';

export function toNotificationResponse(row: Notification) {
  return {
    id: row.id,
    organisationId: row.organisationId,
    recipientUserId: row.recipientUserId,
    type: row.type,
    priority: row.priority,
    title: row.title,
    body: row.body,
    data: row.data,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}

export function toNotificationPreferenceResponse(row: NotificationPreference) {
  return {
    id: row.id,
    userId: row.userId,
    inAppEnabled: row.inAppEnabled,
    pushEnabled: row.pushEnabled,
    smsEnabled: row.smsEnabled,
    emailEnabled: row.emailEnabled,
    quietHoursEnabled: row.quietHoursEnabled,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
    criticalAlertsAlwaysEnabled: row.criticalAlertsAlwaysEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
