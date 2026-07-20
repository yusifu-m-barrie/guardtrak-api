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
import { UpdatePatrolCheckpointDto } from './dto/update-patrol-checkpoint.dto';
import { PatrolCheckpointsService } from './patrol-checkpoints.service';

@ApiTags('patrol-checkpoints')
@ApiBearerAuth()
@Controller('patrol-checkpoints')
export class PatrolCheckpointsController {
  constructor(private readonly checkpointsService: PatrolCheckpointsService) {}

  @Get(':id')
  @Permissions('patrol-checkpoint:read')
  @ApiOperation({ summary: 'Get patrol checkpoint by ID' })
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.checkpointsService.findOne(user, id);
  }

  @Patch(':id')
  @Permissions('patrol-checkpoint:update')
  @ApiOperation({ summary: 'Update patrol checkpoint' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatrolCheckpointDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.checkpointsService.update(user, id, dto, this.ctx(req));
  }

  @Delete(':id')
  @Permissions('patrol-checkpoint:archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-archive patrol checkpoint' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async archive(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { requestId?: string },
  ): Promise<void> {
    await this.checkpointsService.archive(user, id, this.ctx(req));
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
