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
  Post,
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
import { CreateSiteDto } from './dto/create-site.dto';
import { ListSitesQueryDto } from './dto/list-sites-query.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { UpdateSiteStatusDto } from './dto/update-site-status.dto';
import { SitesService } from './sites.service';

@ApiTags('sites')
@ApiBearerAuth()
@Controller('sites')
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post()
  @Permissions('site:create')
  @ApiOperation({ summary: 'Create a security site' })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateSiteDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.sitesService.create(user, dto, this.ctx(req));
  }

  @Get()
  @Permissions('site:read')
  @ApiOperation({ summary: 'List organisation security sites' })
  findAll(@CurrentUser() user: RequestUser, @Query() query: ListSitesQueryDto) {
    return this.sitesService.findAll(user, query);
  }

  @Get(':id')
  @Permissions('site:read')
  @ApiOperation({ summary: 'Get a security site by ID' })
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sitesService.findOne(user, id);
  }

  @Patch(':id')
  @Permissions('site:update')
  @ApiOperation({ summary: 'Update a security site' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSiteDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.sitesService.update(user, id, dto, this.ctx(req));
  }

  @Patch(':id/status')
  @Permissions('site:update')
  @ApiOperation({ summary: 'Update security site status' })
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSiteStatusDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.sitesService.updateStatus(user, id, dto, this.ctx(req));
  }

  @Delete(':id')
  @Permissions('site:archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-archive a security site' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async archive(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { requestId?: string },
  ): Promise<void> {
    await this.sitesService.archive(user, id, this.ctx(req));
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
