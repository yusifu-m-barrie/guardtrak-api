import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailProviderName } from '../../config/config.types';
import { EmailService } from './email.service';
import { EMAIL_PROVIDER, type EmailProvider } from './email.types';
import { ResendEmailProvider } from './providers/resend.provider';
import { SesEmailProvider } from './providers/ses.provider';
import { SmtpEmailProvider } from './providers/smtp.provider';

@Global()
@Module({
  providers: [
    SmtpEmailProvider,
    ResendEmailProvider,
    SesEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      inject: [
        ConfigService,
        SmtpEmailProvider,
        ResendEmailProvider,
        SesEmailProvider,
      ],
      useFactory: (
        config: ConfigService,
        smtp: SmtpEmailProvider,
        resend: ResendEmailProvider,
        ses: SesEmailProvider,
      ): EmailProvider => {
        const provider =
          config.get<EmailProviderName>('email.provider') ?? 'smtp';
        if (provider === 'resend') {
          return resend;
        }
        if (provider === 'ses') {
          return ses;
        }
        return smtp;
      },
    },
    EmailService,
  ],
  exports: [EmailService, EMAIL_PROVIDER],
})
export class EmailModule {}
