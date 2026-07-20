import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { REQUEST_ID_HEADER } from '../../common/constants/metadata-keys';
import type { RequestUser } from '../../common/types/request-user.type';
import { BatchCreatePatrolCheckpointsDto } from './dto/batch-create-patrol-checkpoints.dto';
import { CreatePatrolCheckpointDto } from './dto/create-patrol-checkpoint.dto';
import { ReorderPatrolCheckpointsDto } from './dto/reorder-patrol-checkpoints.dto';
import { PatrolCheckpointsService } from './patrol-checkpoints.service';

@ApiTags('patrol-checkpoints')
@ApiBearerAuth()
@Controller('patrol-routes/:routeId/checkpoints')
export class PatrolRouteCheckpointsController {
  constructor(private readonly checkpointsService: PatrolCheckpointsService) {}

  @Post()
  @Permissions('patrol-checkpoint:create')
  @ApiOperation({ summary: 'Create a checkpoint on a patrol route' })
  create(
    @CurrentUser() user: RequestUser,
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Body() dto: CreatePatrolCheckpointDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.checkpointsService.create(user, routeId, dto, this.ctx(req));
  }

  @Post('batch')
  @Permissions('patrol-checkpoint:create')
  @ApiOperation({ summary: 'Batch-create checkpoints on a patrol route' })
  createBatch(
    @CurrentUser() user: RequestUser,
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Body() dto: BatchCreatePatrolCheckpointsDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.checkpointsService.createBatch(
      user,
      routeId,
      dto,
      this.ctx(req),
    );
  }

  @Get()
  @Permissions('patrol-checkpoint:read')
  @ApiOperation({ summary: 'List checkpoints for a patrol route' })
  list(
    @CurrentUser() user: RequestUser,
    @Param('routeId', ParseUUIDPipe) routeId: string,
  ) {
    return this.checkpointsService.listByRoute(user, routeId);
  }

  @Post('reorder')
  @Permissions('patrol-checkpoint:reorder')
  @ApiOperation({ summary: 'Reorder checkpoints on a patrol route' })
  reorder(
    @CurrentUser() user: RequestUser,
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Body() dto: ReorderPatrolCheckpointsDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.checkpointsService.reorder(user, routeId, dto, this.ctx(req));
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
