import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { AssignIncidentDto } from './dto/assign-incident.dto';
import { CloseIncidentDto } from './dto/close-incident.dto';
import { CreateIncidentNoteDto } from './dto/create-incident-note.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { EscalateIncidentDto } from './dto/escalate-incident.dto';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { ReopenIncidentDto } from './dto/reopen-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentsService } from './incidents.service';

@ApiTags('incidents')
@ApiBearerAuth()
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @Permissions('incident:create:self')
  @ApiOperation({ summary: 'Create incident (idempotent)' })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateIncidentDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.incidentsService.create(user, dto, this.ctx(req));
  }

  @Get()
  @ApiOperation({ summary: 'List incidents (tenant + role scoped)' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: ListIncidentsQueryDto,
  ) {
    return this.incidentsService.findAll(user, query);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Incident statistics for accessible scope' })
  statistics(@CurrentUser() user: RequestUser) {
    return this.incidentsService.statistics(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get incident by id' })
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.incidentsService.findOne(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update incident fields' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncidentDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.incidentsService.update(user, id, dto, this.ctx(req));
  }

  @Post(':id/assign')
  @Permissions('incident:assign')
  @ApiOperation({ summary: 'Assign incident to supervisor' })
  assign(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignIncidentDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.incidentsService.assign(user, id, dto, this.ctx(req));
  }

  @Post(':id/close')
  @Permissions('incident:close')
  @ApiOperation({ summary: 'Close incident' })
  close(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseIncidentDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.incidentsService.close(user, id, dto, this.ctx(req));
  }

  @Post(':id/reopen')
  @Permissions('incident:reopen')
  @ApiOperation({ summary: 'Reopen closed/rejected incident' })
  reopen(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReopenIncidentDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.incidentsService.reopen(user, id, dto, this.ctx(req));
  }

  @Post(':id/escalate')
  @Permissions('incident:escalate')
  @ApiOperation({ summary: 'Escalate incident' })
  escalate(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EscalateIncidentDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.incidentsService.escalate(user, id, dto, this.ctx(req));
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add incident note' })
  addNote(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateIncidentNoteDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.incidentsService.addNote(user, id, dto, this.ctx(req));
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Incident status timeline and notes' })
  timeline(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.incidentsService.timeline(user, id);
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
