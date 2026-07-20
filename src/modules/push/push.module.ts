import { Module } from '@nestjs/common';
import { ApnsPushProvider } from './providers/apns.provider';
import { FcmPushProvider } from './providers/fcm.provider';
import { PushService } from './push.service';
import { APNS_PUSH_PROVIDER, FCM_PUSH_PROVIDER } from './push.types';

@Module({
  providers: [
    FcmPushProvider,
    ApnsPushProvider,
    { provide: FCM_PUSH_PROVIDER, useExisting: FcmPushProvider },
    { provide: APNS_PUSH_PROVIDER, useExisting: ApnsPushProvider },
    PushService,
  ],
  exports: [PushService],
})
export class PushModule {}
