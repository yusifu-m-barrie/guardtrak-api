import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type {
  EmailProvider,
  SendEmailInput,
  SendEmailResult,
} from '../email.types';

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const enabled = this.configService.get<boolean>('email.enabled') === true;
    if (!enabled) {
      this.logger.debug(
        `Email disabled; skipped message to ${input.to}: ${input.subject}`,
      );
      return { queued: false, skipped: true };
    }

    const from = this.configService.get<string>('email.smtpFrom') ?? '';
    const result: unknown = await this.getTransporter().sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    const messageId = this.extractMessageId(result);
    return { queued: true, messageId };
  }

  private extractMessageId(result: unknown): string | undefined {
    if (typeof result !== 'object' || result === null) {
      return undefined;
    }
    if (!('messageId' in result)) {
      return undefined;
    }
    const record = result as Record<string, unknown>;
    const messageId = record.messageId;
    return typeof messageId === 'string' ? messageId : undefined;
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const host =
        this.configService.get<string>('email.smtpHost') ?? 'localhost';
      const port = this.configService.get<number>('email.smtpPort') ?? 1025;
      const user = this.configService.get<string>('email.smtpUser') ?? '';
      const pass = this.configService.get<string>('email.smtpPass') ?? '';
      this.transporter = createTransport({
        host,
        port,
        secure: port === 465,
        ...(user ? { auth: { user, pass } } : {}),
      });
    }
    return this.transporter;
  }
}
