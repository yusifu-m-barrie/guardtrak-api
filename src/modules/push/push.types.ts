export interface SendPushInput {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  silent?: boolean;
}

export interface SendPushResult {
  success: boolean;
  skipped?: boolean;
  inactive?: boolean;
  messageId?: string;
  failureReason?: string;
}

export interface PushProvider {
  send(input: SendPushInput): Promise<SendPushResult>;
}

export const FCM_PUSH_PROVIDER = Symbol('FCM_PUSH_PROVIDER');
export const APNS_PUSH_PROVIDER = Symbol('APNS_PUSH_PROVIDER');
