import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ACCESS_TOKEN_TYPE } from '../auth/auth.constants';
import type { AccessTokenClaims } from '../auth/services/token.service';
import { REALTIME_EVENTS, type RealtimeEventPayload } from './realtime.events';

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server: Server | null = null;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.enabled = this.configService.get<boolean>('ws.enabled') === true;
  }

  getServer(): Server | null {
    return this.server;
  }

  handleConnection(@ConnectedSocket() client: Socket): void {
    if (!this.enabled) {
      client.disconnect(true);
      return;
    }

    void this.authenticateClient(client);
  }

  handleDisconnect(@ConnectedSocket() client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @OnEvent(REALTIME_EVENTS.ATTENDANCE_UPDATED)
  onAttendanceUpdated(payload: RealtimeEventPayload): void {
    this.forward(REALTIME_EVENTS.ATTENDANCE_UPDATED, payload);
  }

  @OnEvent(REALTIME_EVENTS.OFFICER_CLOCKED_IN)
  onOfficerClockedIn(payload: RealtimeEventPayload): void {
    this.forward(REALTIME_EVENTS.OFFICER_CLOCKED_IN, payload);
  }

  @OnEvent(REALTIME_EVENTS.OFFICER_CLOCKED_OUT)
  onOfficerClockedOut(payload: RealtimeEventPayload): void {
    this.forward(REALTIME_EVENTS.OFFICER_CLOCKED_OUT, payload);
  }

  @OnEvent(REALTIME_EVENTS.INCIDENT_CREATED)
  onIncidentCreated(payload: RealtimeEventPayload): void {
    this.forward(REALTIME_EVENTS.INCIDENT_CREATED, payload);
  }

  @OnEvent(REALTIME_EVENTS.INCIDENT_UPDATED)
  onIncidentUpdated(payload: RealtimeEventPayload): void {
    this.forward(REALTIME_EVENTS.INCIDENT_UPDATED, payload);
  }

  @OnEvent(REALTIME_EVENTS.SOS_TRIGGERED)
  onSosTriggered(payload: RealtimeEventPayload): void {
    this.forward(REALTIME_EVENTS.SOS_TRIGGERED, payload);
  }

  @OnEvent(REALTIME_EVENTS.SOS_RESOLVED)
  onSosResolved(payload: RealtimeEventPayload): void {
    this.forward(REALTIME_EVENTS.SOS_RESOLVED, payload);
  }

  @OnEvent(REALTIME_EVENTS.PATROL_STARTED)
  onPatrolStarted(payload: RealtimeEventPayload): void {
    this.forward(REALTIME_EVENTS.PATROL_STARTED, payload);
  }

  @OnEvent(REALTIME_EVENTS.PATROL_COMPLETED)
  onPatrolCompleted(payload: RealtimeEventPayload): void {
    this.forward(REALTIME_EVENTS.PATROL_COMPLETED, payload);
  }

  @OnEvent(REALTIME_EVENTS.NOTIFICATION_RECEIVED)
  onNotificationReceived(payload: RealtimeEventPayload): void {
    this.forward(REALTIME_EVENTS.NOTIFICATION_RECEIVED, payload);
  }

  @OnEvent(REALTIME_EVENTS.DASHBOARD_REFRESH)
  onDashboardRefresh(payload: RealtimeEventPayload): void {
    this.forward(REALTIME_EVENTS.DASHBOARD_REFRESH, payload);
  }

  private forward(event: string, payload: RealtimeEventPayload): void {
    if (!this.server || !payload.organisationId) {
      return;
    }

    this.server.to(`org:${payload.organisationId}`).emit(event, payload);
  }

  private async authenticateClient(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`WS connection rejected (${client.id}): missing token`);
      client.disconnect(true);
      return;
    }

    try {
      const issuer =
        this.configService.get<string>('jwt.issuer') ?? 'guardtrak-api';
      const audience =
        this.configService.get<string>('jwt.audience') ?? 'guardtrak-clients';
      const payload = await this.jwtService.verifyAsync<AccessTokenClaims>(
        token,
        {
          secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
          issuer,
          audience,
        },
      );

      if (payload.type !== ACCESS_TOKEN_TYPE || !payload.organisationId) {
        client.disconnect(true);
        return;
      }

      await client.join(`org:${payload.organisationId}`);
      this.logger.debug(
        `Client ${client.id} joined org:${payload.organisationId}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'invalid token';
      this.logger.warn(`WS connection rejected (${client.id}): ${message}`);
      client.disconnect(true);
    }
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    const authToken = auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const authorization = client.handshake.headers.authorization;
    if (typeof authorization === 'string') {
      const [scheme, value] = authorization.split(' ');
      if (scheme?.toLowerCase() === 'bearer' && value) {
        return value;
      }
    }

    return null;
  }
}
