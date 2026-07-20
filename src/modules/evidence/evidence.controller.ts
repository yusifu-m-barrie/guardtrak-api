import {
  Body,
  Controller,
  Delete,
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
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { RequestUploadUrlDto } from './dto/request-upload-url.dto';
import { EvidenceService } from './evidence.service';

@ApiTags('evidence')
@ApiBearerAuth()
@Controller('incidents/:incidentId/evidence')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post('upload-url')
  @Permissions('evidence:upload:self')
  @ApiOperation({ summary: 'Request evidence upload URL' })
  uploadUrl(
    @CurrentUser() user: RequestUser,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @Body() dto: RequestUploadUrlDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.evidenceService.requestUploadUrl(
      user,
      incidentId,
      dto,
      this.ctx(req),
    );
  }

  @Post('complete')
  @Permissions('evidence:upload:self')
  @ApiOperation({ summary: 'Complete evidence upload' })
  complete(
    @CurrentUser() user: RequestUser,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @Body() dto: CompleteUploadDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.evidenceService.completeUpload(
      user,
      incidentId,
      dto,
      this.ctx(req),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List evidence for incident' })
  list(
    @CurrentUser() user: RequestUser,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
  ) {
    return this.evidenceService.listForIncident(user, incidentId);
  }

  @Delete(':evidenceId')
  @Permissions('evidence:delete')
  @ApiOperation({ summary: 'Soft-delete evidence' })
  remove(
    @CurrentUser() user: RequestUser,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.evidenceService.softDelete(
      user,
      incidentId,
      evidenceId,
      this.ctx(req),
    );
  }

  @Post(':evidenceId/verify')
  @Permissions('evidence:verify')
  @ApiOperation({ summary: 'Verify evidence (supervisor)' })
  verify(
    @CurrentUser() user: RequestUser,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.evidenceService.verify(
      user,
      incidentId,
      evidenceId,
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
