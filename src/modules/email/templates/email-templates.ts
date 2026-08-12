export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function interpolate(template: string, locale: string): string {
  return template.replace(/\{\{locale\}\}/g, locale);
}

export function buildPasswordResetTemplate(
  otp: string,
  expiresMinutes: number,
  locale = 'en',
): EmailTemplate {
  return {
    subject: interpolate(
      'Password reset code — FOLPS [{{locale}}]',
      locale,
    ),
    html: `<p>Your password reset code is <strong>${otp}</strong>.</p><p>It expires in ${expiresMinutes} minutes.</p>`,
    text: `Your password reset code is ${otp}. It expires in ${expiresMinutes} minutes.`,
  };
}

export function buildWelcomeTemplate(
  displayName: string,
  locale = 'en',
): EmailTemplate {
  return {
    subject: interpolate('Welcome to FOLPS [{{locale}}]', locale),
    html: `<p>Hello ${displayName},</p><p>Welcome to FOLPS.</p>`,
    text: `Hello ${displayName}, welcome to FOLPS.`,
  };
}

export function buildSupportTicketTemplate(
  ticketNumber: string,
  subject: string,
  locale = 'en',
): EmailTemplate {
  return {
    subject: interpolate(
      `Support ticket ${ticketNumber}: ${subject} [{{locale}}]`,
      locale,
    ),
    html: `<p>Support ticket <strong>${ticketNumber}</strong> has been received.</p><p>Subject: ${subject}</p>`,
    text: `Support ticket ${ticketNumber} received. Subject: ${subject}.`,
  };
}

export function buildIncidentAlertTemplate(
  incidentNumber: string,
  title: string,
  locale = 'en',
): EmailTemplate {
  return {
    subject: interpolate(
      `Incident alert ${incidentNumber} [{{locale}}]`,
      locale,
    ),
    html: `<p>Incident <strong>${incidentNumber}</strong>: ${title}</p>`,
    text: `Incident ${incidentNumber}: ${title}`,
  };
}

export function buildSupervisorAlertTemplate(
  message: string,
  locale = 'en',
): EmailTemplate {
  return {
    subject: interpolate('Supervisor alert — FOLPS [{{locale}}]', locale),
    html: `<p>${message}</p>`,
    text: message,
  };
}

export function buildSosAlertTemplate(
  emergencyNumber: string,
  locale = 'en',
): EmailTemplate {
  return {
    subject: interpolate(`SOS alert ${emergencyNumber} [{{locale}}]`, locale),
    html: `<p><strong>SOS</strong> triggered: ${emergencyNumber}. Immediate response required.</p>`,
    text: `SOS triggered: ${emergencyNumber}. Immediate response required.`,
  };
}
