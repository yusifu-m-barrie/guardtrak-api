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
import { BatchCreatePatrolAssignmentsDto } from './dto/batch-create-patrol-assignments.dto';
import { CancelPatrolAssignmentDto } from './dto/cancel-patrol-assignment.dto';
import { CompletePatrolAssignmentDto } from './dto/complete-patrol-assignment.dto';
import { CreatePatrolAssignmentDto } from './dto/create-patrol-assignment.dto';
import { ListPatrolAssignmentsQueryDto } from './dto/list-patrol-assignments-query.dto';
import { ListUpcomingPatrolAssignmentsQueryDto } from './dto/list-upcoming-patrol-assignments-query.dto';
import { MarkMissedPatrolAssignmentDto } from './dto/mark-missed-patrol-assignment.dto';
import { StartPatrolAssignmentDto } from './dto/start-patrol-assignment.dto';
import { PatrolAssignmentsService } from './patrol-assignments.service';

@ApiTags('patrol-assignments')
@ApiBearerAuth()
@Controller('patrol-assignments')
export class PatrolAssignmentsController {
  constructor(private readonly assignmentsService: PatrolAssignmentsService) {}

  @Post()
  @Permissions('patrol-assignment:create')
  @ApiOperation({
    summary: 'Create a patrol assignment with checkpoint snapshots',
  })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePatrolAssignmentDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.assignmentsService.create(user, dto, this.ctx(req));
  }

  @Post('batch')
  @Permissions('patrol-assignment:create')
  @ApiOperation({ summary: 'Batch-create patrol assignments' })
  createBatch(
    @CurrentUser() user: RequestUser,
    @Body() dto: BatchCreatePatrolAssignmentsDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.assignmentsService.createBatch(user, dto, this.ctx(req));
  }

  @Get()
  @Permissions('patrol-assignment:read')
  @ApiOperation({ summary: 'List patrol assignments' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: ListPatrolAssignmentsQueryDto,
  ) {
    return this.assignmentsService.findAll(user, query);
  }

  @Get('current')
  @Permissions('patrol-assignment:read:self')
  @ApiOperation({ summary: 'Get current due/active patrol for officer' })
  current(@CurrentUser() user: RequestUser) {
    return this.assignmentsService.current(user);
  }

  @Get('upcoming')
  @Permissions('patrol-assignment:read:self')
  @ApiOperation({ summary: 'List upcoming patrols for officer' })
  upcoming(
    @CurrentUser() user: RequestUser,
    @Query() query: ListUpcomingPatrolAssignmentsQueryDto,
  ) {
    return this.assignmentsService.upcoming(user, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get patrol assignment by ID (tenant + self scoped)',
  })
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assignmentsService.findOne(user, id);
  }

  @Post(':id/start')
  @Permissions('patrol-assignment:read:self')
  @ApiOperation({ summary: 'Start a patrol assignment' })
  start(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartPatrolAssignmentDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.assignmentsService.start(user, id, dto, this.ctx(req));
  }

  @Post(':id/complete')
  @Permissions('patrol-assignment:read:self')
  @ApiOperation({ summary: 'Complete a patrol assignment' })
  complete(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompletePatrolAssignmentDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.assignmentsService.complete(user, id, dto, this.ctx(req));
  }

  @Post(':id/cancel')
  @Permissions('patrol-assignment:cancel')
  @ApiOperation({ summary: 'Cancel a patrol assignment' })
  cancel(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelPatrolAssignmentDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.assignmentsService.cancel(user, id, dto, this.ctx(req));
  }

  @Post(':id/mark-missed')
  @Permissions('patrol-assignment:review')
  @ApiOperation({ summary: 'Mark a patrol assignment as missed' })
  markMissed(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkMissedPatrolAssignmentDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.assignmentsService.markMissed(user, id, dto, this.ctx(req));
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
