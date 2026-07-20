import { Injectable, Logger } from '@nestjs/common';
import type { RealtimeEventName } from './realtime.events';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimePublisher {
  private readonly logger = new Logger(RealtimePublisher.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  publish(
    organisationId: string,
    event: RealtimeEventName,
    payload: Record<string, unknown>,
  ): void {
    const server = this.gateway.getServer();
    if (!server) {
      this.logger.debug(
        `Skipping realtime publish for ${event} — gateway unavailable`,
      );
      return;
    }

    server.to(`org:${organisationId}`).emit(event, payload);
  }
}
