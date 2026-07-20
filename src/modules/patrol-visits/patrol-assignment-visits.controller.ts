import {
  Body,
  Controller,
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
import { CreatePatrolVisitDto } from './dto/create-patrol-visit.dto';
import { PatrolVisitsService } from './patrol-visits.service';

@ApiTags('patrol-visits')
@ApiBearerAuth()
@Controller('patrol-assignments/:patrolAssignmentId/checkpoints')
export class PatrolAssignmentVisitsController {
  constructor(private readonly visitsService: PatrolVisitsService) {}

  @Post(':checkpointId/visit')
  @Permissions('patrol-visit:create:self')
  @ApiOperation({
    summary: 'Record a checkpoint visit (snapshot or source checkpoint id)',
  })
  createVisit(
    @CurrentUser() user: RequestUser,
    @Param('patrolAssignmentId', ParseUUIDPipe) patrolAssignmentId: string,
    @Param('checkpointId', ParseUUIDPipe) checkpointId: string,
    @Body() dto: CreatePatrolVisitDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.visitsService.createVisit(
      user,
      patrolAssignmentId,
      checkpointId,
      dto,
      this.ctx(req),
    );
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
