import { Injectable, Logger } from '@nestjs/common';
import type {
  PushProvider,
  SendPushInput,
  SendPushResult,
} from '../push.types';

@Injectable()
export class ApnsPushProvider implements PushProvider {
  private readonly logger = new Logger(ApnsPushProvider.name);

  send(input: SendPushInput): Promise<SendPushResult> {
    this.logger.warn('APNs push provider not implemented; skipping delivery');
    void input;
    return Promise.resolve({ success: true, skipped: true });
  }
}
