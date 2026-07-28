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
import { BatchCreateAssignmentsDto } from './dto/batch-create-assignments.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { ListAssignmentsQueryDto } from './dto/list-assignments-query.dto';
import { ListUpcomingAssignmentsQueryDto } from './dto/list-upcoming-assignments-query.dto';
import { ReassignAssignmentDto } from './dto/reassign-assignment.dto';
import { UpdateAssignmentStatusDto } from './dto/update-assignment-status.dto';
import { AssignmentsService } from './assignments.service';

@ApiTags('assignments')
@ApiBearerAuth()
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Permissions('assignment:create')
  @ApiOperation({ summary: 'Create an officer assignment' })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateAssignmentDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.assignmentsService.create(user, dto, this.ctx(req));
  }

  @Post('batch')
  @Permissions('assignment:create')
  @ApiOperation({ summary: 'Batch-create assignments (all-or-nothing)' })
  createBatch(
    @CurrentUser() user: RequestUser,
    @Body() dto: BatchCreateAssignmentsDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.assignmentsService.createBatch(user, dto, this.ctx(req));
  }

  @Get()
  @Permissions('assignment:read')
  @ApiOperation({ summary: 'List organisation assignments' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: ListAssignmentsQueryDto,
  ) {
    return this.assignmentsService.findAll(user, query);
  }

  @Get('current')
  @Permissions('assignment:read:self')
  @ApiOperation({ summary: 'Current assignment for authenticated officer' })
  findCurrent(@CurrentUser() user: RequestUser) {
    return this.assignmentsService.findCurrent(user);
  }

  @Get('upcoming')
  @Permissions('assignment:read:self')
  @ApiOperation({ summary: 'Upcoming assignments for authenticated officer' })
  findUpcoming(
    @CurrentUser() user: RequestUser,
    @Query() query: ListUpcomingAssignmentsQueryDto,
  ) {
    return this.assignmentsService.findUpcoming(user, query);
  }

  @Get('history')
  @Permissions('assignment:read:self')
  @ApiOperation({
    summary: 'Past assignments for authenticated officer (completed, cancelled, ended)',
  })
  findHistory(
    @CurrentUser() user: RequestUser,
    @Query() query: ListUpcomingAssignmentsQueryDto,
  ) {
    return this.assignmentsService.findHistory(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get assignment by ID (tenant + self scoped)' })
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assignmentsService.findOne(user, id);
  }

  @Patch(':id/status')
  @Permissions('assignment:update')
  @ApiOperation({ summary: 'Update assignment status' })
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssignmentStatusDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.assignmentsService.updateStatus(user, id, dto, this.ctx(req));
  }

  @Post(':id/confirm')
  @Permissions('assignment:confirm:self')
  @ApiOperation({ summary: 'Officer confirms own assignment' })
  confirm(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.assignmentsService.confirm(user, id, this.ctx(req));
  }

  @Post(':id/reassign')
  @Permissions('assignment:reassign')
  @ApiOperation({ summary: 'Reassign to a replacement officer' })
  reassign(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignAssignmentDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.assignmentsService.reassign(user, id, dto, this.ctx(req));
  }

  @Delete(':id')
  @Permissions('assignment:cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel assignment if not started' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async cancel(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { requestId?: string },
  ): Promise<void> {
    await this.assignmentsService.cancel(user, id, this.ctx(req));
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
