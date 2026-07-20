import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildIncidentAlertTemplate,
  buildPasswordResetTemplate,
  buildSosAlertTemplate,
  buildSupervisorAlertTemplate,
  buildSupportTicketTemplate,
  buildWelcomeTemplate,
} from './templates/email-templates';
import { EMAIL_PROVIDER, type EmailProvider } from './email.types';

@Injectable()
export class EmailService {
  constructor(
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
    private readonly configService: ConfigService,
  ) {}

  sendPasswordReset(input: { to: string; otp: string; locale?: string }) {
    const expiresMinutes =
      this.configService.get<number>('auth.passwordResetOtpExpiresMinutes') ??
      10;
    const template = buildPasswordResetTemplate(
      input.otp,
      expiresMinutes,
      input.locale ?? 'en',
    );
    return this.provider.send({ to: input.to, ...template });
  }

  sendWelcome(input: { to: string; displayName: string; locale?: string }) {
    const template = buildWelcomeTemplate(
      input.displayName,
      input.locale ?? 'en',
    );
    return this.provider.send({ to: input.to, ...template });
  }

  sendSupportTicket(input: {
    to: string;
    ticketNumber: string;
    subject: string;
    locale?: string;
  }) {
    const template = buildSupportTicketTemplate(
      input.ticketNumber,
      input.subject,
      input.locale ?? 'en',
    );
    return this.provider.send({ to: input.to, ...template });
  }

  sendIncidentAlert(input: {
    to: string;
    incidentNumber: string;
    title: string;
    locale?: string;
  }) {
    const template = buildIncidentAlertTemplate(
      input.incidentNumber,
      input.title,
      input.locale ?? 'en',
    );
    return this.provider.send({ to: input.to, ...template });
  }

  sendSupervisorAlert(input: { to: string; message: string; locale?: string }) {
    const template = buildSupervisorAlertTemplate(
      input.message,
      input.locale ?? 'en',
    );
    return this.provider.send({ to: input.to, ...template });
  }

  sendSosAlert(input: {
    to: string;
    emergencyNumber: string;
    locale?: string;
  }) {
    const template = buildSosAlertTemplate(
      input.emergencyNumber,
      input.locale ?? 'en',
    );
    return this.provider.send({ to: input.to, ...template });
  }
}
