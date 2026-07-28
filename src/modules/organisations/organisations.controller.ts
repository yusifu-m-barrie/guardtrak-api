import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user.type';
import { REQUEST_ID_HEADER } from '../../common/constants/metadata-keys';
import { OrganisationsService } from './organisations.service';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { UpdateOrganisationSettingsDto } from './dto/update-organisation-settings.dto';

@ApiTags('organisation')
@ApiBearerAuth()
@Controller('organisation')
export class OrganisationsController {
  constructor(private readonly organisationsService: OrganisationsService) {}

  @Get()
  @Permissions('organisation:read:self')
  @ApiOperation({ summary: 'Get the authenticated organisation summary' })
  getSelf(@CurrentUser() user: RequestUser) {
    return this.organisationsService.getSelf(user);
  }

  @Patch()
  @Permissions('organisation:update:self')
  @ApiOperation({ summary: 'Update safe organisation profile fields' })
  updateSelf(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateOrganisationDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.organisationsService.updateSelf(user, dto, this.ctx(req));
  }

  @Get('settings')
  @Permissions('organisation:read:self')
  @ApiOperation({ summary: 'Get organisation operational settings' })
  getSettings(@CurrentUser() user: RequestUser) {
    return this.organisationsService.getSettings(user);
  }

  @Patch('settings')
  @Permissions('organisation:update:self')
  @ApiOperation({ summary: 'Update organisation operational settings' })
  updateSettings(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateOrganisationSettingsDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.organisationsService.updateSettings(user, dto, this.ctx(req));
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
