import {
  Body,
  Controller,
  Delete,
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
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { REQUEST_ID_HEADER } from '../../common/constants/metadata-keys';
import type { RequestUser } from '../../common/types/request-user.type';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { UpdateSupportStatusDto } from './dto/update-support-status.dto';
import { UpsertFaqDto } from './dto/upsert-faq.dto';
import { SupportService } from './support.service';

@ApiTags('support')
@Controller()
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Public()
  @Get('help/faq')
  @ApiOperation({
    summary: 'List published FAQ articles (global + optional org)',
  })
  listFaqPublic() {
    return this.supportService.listFaq(null);
  }

  @ApiBearerAuth()
  @Get('help/faq/org')
  @ApiOperation({
    summary: 'List published FAQ including organisation articles',
  })
  listFaqOrg(@CurrentUser() user: RequestUser) {
    return this.supportService.listFaq(user);
  }

  @ApiBearerAuth()
  @Post('help/faq')
  @Permissions('faq:manage')
  @ApiOperation({ summary: 'Create FAQ article' })
  createFaq(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpsertFaqDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.supportService.createFaq(user, dto, this.ctx(req));
  }

  @ApiBearerAuth()
  @Patch('help/faq/:id')
  @Permissions('faq:manage')
  @ApiOperation({ summary: 'Update FAQ article' })
  updateFaq(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertFaqDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.supportService.updateFaq(user, id, dto, this.ctx(req));
  }

  @ApiBearerAuth()
  @Delete('help/faq/:id')
  @Permissions('faq:manage')
  @ApiOperation({ summary: 'Soft-delete FAQ article' })
  deleteFaq(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.supportService.deleteFaq(user, id, this.ctx(req));
  }

  @ApiBearerAuth()
  @Post('support/requests')
  @Permissions('support:create:self')
  @ApiOperation({ summary: 'Create support request' })
  createRequest(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateSupportRequestDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.supportService.createRequest(user, dto, this.ctx(req));
  }

  @ApiBearerAuth()
  @Get('support/requests')
  @ApiOperation({ summary: 'List support requests' })
  listRequests(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.supportService.listRequests(
      user,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @ApiBearerAuth()
  @Get('support/requests/:id')
  @ApiOperation({ summary: 'Get support request with messages' })
  getRequest(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.supportService.getRequest(user, id);
  }

  @ApiBearerAuth()
  @Post('support/requests/:id/messages')
  @ApiOperation({ summary: 'Add support message' })
  addMessage(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSupportMessageDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.supportService.addMessage(user, id, dto, this.ctx(req));
  }

  @ApiBearerAuth()
  @Patch('support/requests/:id/status')
  @Permissions('support:update')
  @ApiOperation({ summary: 'Update support request status' })
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupportStatusDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.supportService.updateStatus(user, id, dto, this.ctx(req));
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
