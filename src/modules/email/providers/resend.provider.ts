import { Injectable, Logger } from '@nestjs/common';
import type {
  EmailProvider,
  SendEmailInput,
  SendEmailResult,
} from '../email.types';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);

  send(input: SendEmailInput): Promise<SendEmailResult> {
    this.logger.warn(
      `Resend email provider not implemented; skipped message to ${input.to}`,
    );
    return Promise.resolve({ queued: false, skipped: true });
  }
}
