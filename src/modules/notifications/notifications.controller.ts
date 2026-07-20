import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { REQUEST_ID_HEADER } from '../../common/constants/metadata-keys';
import type { RequestUser } from '../../common/types/request-user.type';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notifications')
  @Permissions('notification:read:self')
  @ApiOperation({ summary: 'List my notifications' })
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.listMine(user, query);
  }

  @Get('notifications/unread-count')
  @Permissions('notification:read:self')
  @ApiOperation({ summary: 'Unread notification count' })
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.notificationsService.unreadCount(user);
  }

  @Get('notifications/preferences')
  @Permissions('notification:update:self')
  @ApiOperation({ summary: 'Get notification preferences' })
  getPreferences(@CurrentUser() user: RequestUser) {
    return this.notificationsService.getPreferences(user);
  }

  @Put('notifications/preferences')
  @Permissions('notification:update:self')
  @ApiOperation({ summary: 'Update notification preferences' })
  updatePreferences(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(user, dto);
  }

  @Post('notifications/read-all')
  @Permissions('notification:read:self')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllRead(user);
  }

  @Get('notifications/:id')
  @Permissions('notification:read:self')
  @ApiOperation({ summary: 'Get one notification by ID' })
  getById(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.getById(user, id);
  }

  @Post('notifications/:id/read')
  @Permissions('notification:read:self')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markRead(user, id);
  }

  @Post('devices/push-token')
  @Permissions('device:push-token:self')
  @ApiOperation({ summary: 'Register device push token' })
  registerPushToken(
    @CurrentUser() user: RequestUser,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.notificationsService.registerPushToken(user, dto);
  }

  @Post('notifications/broadcast')
  @Permissions('notification:broadcast')
  @ApiOperation({ summary: 'Broadcast notification (admin)' })
  broadcast(
    @CurrentUser() user: RequestUser,
    @Body() dto: BroadcastNotificationDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.notificationsService.broadcast(user, dto, this.ctx(req));
  }

  private ctx(req: Request & { requestId?: string }) {
    const requestIdHeader = req.headers[REQUEST_ID_HEADER];
    return {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
      requestId:
        req.requestId ??
        (typeof requestIdHeader === 'string' ? requestIdHeader : null),
    };
  }
}
