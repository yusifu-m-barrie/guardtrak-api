import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { REQUEST_ID_HEADER } from '../../common/constants/metadata-keys';
import type { RequestUser } from '../../common/types/request-user.type';
import { ListMyPatrolVisitsQueryDto } from './dto/list-my-patrol-visits-query.dto';
import { ListPatrolVisitsQueryDto } from './dto/list-patrol-visits-query.dto';
import { OverridePatrolVisitDto } from './dto/override-patrol-visit.dto';
import { ReviewPatrolVisitDto } from './dto/review-patrol-visit.dto';
import { PatrolVisitsService } from './patrol-visits.service';

@ApiTags('patrol-visits')
@ApiBearerAuth()
@Controller('patrol-visits')
export class PatrolVisitsController {
  constructor(private readonly visitsService: PatrolVisitsService) {}

  @Get('me')
  @Permissions('patrol-visit:read:self')
  @ApiOperation({ summary: 'List own patrol visits' })
  listMine(
    @CurrentUser() user: RequestUser,
    @Query() query: ListMyPatrolVisitsQueryDto,
  ) {
    return this.visitsService.listMine(user, query);
  }

  @Get()
  @Permissions('patrol-visit:read')
  @ApiOperation({ summary: 'List organisation patrol visits' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: ListPatrolVisitsQueryDto,
  ) {
    return this.visitsService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patrol visit by ID (tenant + self scoped)' })
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.visitsService.findOne(user, id);
  }

  @Post(':id/approve')
  @Permissions('patrol-visit:review')
  @ApiOperation({ summary: 'Approve a patrol visit under review' })
  approve(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewPatrolVisitDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.visitsService.approve(user, id, dto, this.ctx(req));
  }

  @Post(':id/reject')
  @Permissions('patrol-visit:review')
  @ApiOperation({ summary: 'Reject a patrol visit under review' })
  reject(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewPatrolVisitDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.visitsService.reject(user, id, dto, this.ctx(req));
  }

  @Post(':id/override')
  @Permissions('patrol-visit:override')
  @ApiOperation({ summary: 'Supervisor override for a patrol visit' })
  override(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OverridePatrolVisitDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.visitsService.override(user, id, dto, this.ctx(req));
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
