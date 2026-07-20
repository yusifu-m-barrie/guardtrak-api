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
import { CancelBreakDto } from './dto/cancel-break.dto';
import { EndBreakDto } from './dto/end-break.dto';
import { ListBreaksQueryDto } from './dto/list-breaks-query.dto';
import { StartBreakDto } from './dto/start-break.dto';
import { BreaksService } from './breaks.service';

@ApiTags('breaks')
@ApiBearerAuth()
@Controller('breaks')
export class BreaksController {
  constructor(private readonly breaksService: BreaksService) {}

  @Post('start')
  @Permissions('break:start:self')
  @ApiOperation({ summary: 'Start a break on active attendance' })
  start(
    @CurrentUser() user: RequestUser,
    @Body() dto: StartBreakDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.breaksService.start(user, dto, this.ctx(req));
  }

  @Post(':id/end')
  @Permissions('break:end:self')
  @ApiOperation({ summary: 'End an active break' })
  end(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EndBreakDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.breaksService.end(user, id, dto, this.ctx(req));
  }

  @Get('current')
  @Permissions('break:read:self')
  @ApiOperation({ summary: 'Current active break for officer' })
  getCurrent(@CurrentUser() user: RequestUser) {
    return this.breaksService.getCurrent(user);
  }

  @Get('me')
  @Permissions('break:read:self')
  @ApiOperation({ summary: 'Paginated break history for officer' })
  listMine(
    @CurrentUser() user: RequestUser,
    @Query() query: ListBreaksQueryDto,
  ) {
    return this.breaksService.listMine(user, query);
  }

  @Get()
  @Permissions('break:read')
  @ApiOperation({ summary: 'List organisation breaks' })
  list(@CurrentUser() user: RequestUser, @Query() query: ListBreaksQueryDto) {
    return this.breaksService.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get break by ID' })
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.breaksService.findOne(user, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an active break' })
  cancel(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBreakDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.breaksService.cancel(user, id, dto, this.ctx(req));
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
