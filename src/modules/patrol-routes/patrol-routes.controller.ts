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
import { CreatePatrolRouteDto } from './dto/create-patrol-route.dto';
import { ListPatrolRoutesQueryDto } from './dto/list-patrol-routes-query.dto';
import { UpdatePatrolRouteDto } from './dto/update-patrol-route.dto';
import { UpdatePatrolRouteStatusDto } from './dto/update-patrol-route-status.dto';
import { PatrolRoutesService } from './patrol-routes.service';

@ApiTags('patrol-routes')
@ApiBearerAuth()
@Controller('patrol-routes')
export class PatrolRoutesController {
  constructor(private readonly routesService: PatrolRoutesService) {}

  @Post()
  @Permissions('patrol-route:create')
  @ApiOperation({ summary: 'Create a draft patrol route' })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePatrolRouteDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.routesService.create(user, dto, this.ctx(req));
  }

  @Get()
  @Permissions('patrol-route:read')
  @ApiOperation({ summary: 'List organisation patrol routes' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: ListPatrolRoutesQueryDto,
  ) {
    return this.routesService.findAll(user, query);
  }

  @Get(':id')
  @Permissions('patrol-route:read')
  @ApiOperation({ summary: 'Get patrol route by ID' })
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.routesService.findOne(user, id);
  }

  @Patch(':id')
  @Permissions('patrol-route:update')
  @ApiOperation({ summary: 'Update patrol route' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatrolRouteDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.routesService.update(user, id, dto, this.ctx(req));
  }

  @Patch(':id/status')
  @Permissions('patrol-route:activate')
  @ApiOperation({ summary: 'Update patrol route status' })
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatrolRouteStatusDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.routesService.updateStatus(user, id, dto, this.ctx(req));
  }

  @Delete(':id')
  @Permissions('patrol-route:archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-archive patrol route' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async archive(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { requestId?: string },
  ): Promise<void> {
    await this.routesService.archive(user, id, this.ctx(req));
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
