import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PushProvider,
  SendPushInput,
  SendPushResult,
} from '../push.types';

@Injectable()
export class FcmPushProvider implements PushProvider {
  private readonly logger = new Logger(FcmPushProvider.name);
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  async send(input: SendPushInput): Promise<SendPushResult> {
    const enabled =
      this.configService.get<boolean>('push.fcm.enabled') === true;
    if (!enabled) {
      this.logger.debug('FCM disabled; skipping push delivery');
      return { success: true, skipped: true };
    }

    const projectId =
      this.configService.get<string>('push.fcm.projectId') ?? '';
    const clientEmail =
      this.configService.get<string>('push.fcm.clientEmail') ?? '';
    const privateKey =
      this.configService.get<string>('push.fcm.privateKey') ?? '';
    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('FCM credentials incomplete; skipping push delivery');
      return { success: true, skipped: true };
    }

    try {
      const { getMessaging } = await this.ensureInitialized(
        projectId,
        clientEmail,
        privateKey,
      );
      const messageId = await getMessaging().send({
        token: input.token,
        notification: input.silent
          ? undefined
          : { title: input.title, body: input.body },
        data: input.data,
        android: { priority: 'high' },
        apns: {
          payload: {
            aps: {
              contentAvailable: input.silent === true,
            },
          },
        },
      });
      return { success: true, messageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const inactive =
        message.includes('registration-token-not-registered') ||
        message.includes('invalid-registration-token') ||
        message.includes('Requested entity was not found');
      if (inactive) {
        return { success: false, inactive: true, failureReason: message };
      }
      this.logger.warn(`FCM send failed: ${message}`);
      return { success: false, failureReason: message };
    }
  }

  private async ensureInitialized(
    projectId: string,
    clientEmail: string,
    privateKey: string,
  ): Promise<typeof import('firebase-admin/messaging')> {
    const appModule = await import('firebase-admin/app');
    const messagingModule = await import('firebase-admin/messaging');

    if (!this.initialized) {
      if (!appModule.getApps().length) {
        appModule.initializeApp({
          credential: appModule.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      }
      this.initialized = true;
    }

    return messagingModule;
  }
}
