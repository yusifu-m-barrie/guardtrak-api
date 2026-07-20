import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { REQUEST_ID_HEADER } from '../../common/constants/metadata-keys';
import type { RequestUser } from '../../common/types/request-user.type';
import { DevicesService } from './devices.service';
import { ListDevicesQueryDto } from './dto/list-devices-query.dto';
import { UpdateDeviceStatusDto } from './dto/update-device-status.dto';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get('me')
  @Permissions('device:read:self')
  @ApiOperation({ summary: 'List devices belonging to the authenticated user' })
  findMine(@CurrentUser() user: RequestUser) {
    return this.devicesService.findMine(user);
  }

  @Get()
  @Permissions('device:read')
  @ApiOperation({ summary: 'List organisation devices (administrator)' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: ListDevicesQueryDto,
  ) {
    return this.devicesService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a device by ID (self or administrator)' })
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.devicesService.findOne(user, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update device status' })
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeviceStatusDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.devicesService.updateStatus(user, id, dto, this.ctx(req));
  }

  @Delete(':id')
  @Permissions('device:revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-retire a device as revoked' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async retire(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { requestId?: string },
  ): Promise<void> {
    await this.devicesService.retire(user, id, this.ctx(req));
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
