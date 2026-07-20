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
import { CreateSosDto } from './dto/create-sos.dto';
import { ListEmergenciesQueryDto } from './dto/list-emergencies-query.dto';
import { UpdateEmergencyStatusDto } from './dto/update-emergency-status.dto';
import { EmergenciesService } from './emergencies.service';

@ApiTags('emergency')
@ApiBearerAuth()
@Controller('emergency')
export class EmergenciesController {
  constructor(private readonly emergenciesService: EmergenciesService) {}

  @Post('sos')
  @Permissions('sos:create:self')
  @ApiOperation({ summary: 'Trigger SOS (idempotent)' })
  createSos(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateSosDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.emergenciesService.createSos(user, dto, this.ctx(req));
  }

  @Get()
  @ApiOperation({ summary: 'List emergencies' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: ListEmergenciesQueryDto,
  ) {
    return this.emergenciesService.findAll(user, query);
  }

  @Get('history')
  @ApiOperation({ summary: 'Emergency history' })
  history(
    @CurrentUser() user: RequestUser,
    @Query() query: ListEmergenciesQueryDto,
  ) {
    return this.emergenciesService.history(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get emergency by id' })
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.emergenciesService.findOne(user, id);
  }

  @Patch(':id/status')
  @Permissions('emergency:manage')
  @ApiOperation({ summary: 'Update emergency status' })
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmergencyStatusDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.emergenciesService.updateStatus(user, id, dto, this.ctx(req));
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
