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
import { CreateShiftDto } from './dto/create-shift.dto';
import { ListShiftsQueryDto } from './dto/list-shifts-query.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { UpdateShiftStatusDto } from './dto/update-shift-status.dto';
import { ShiftsService } from './shifts.service';

@ApiTags('shifts')
@ApiBearerAuth()
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  @Permissions('shift:create')
  @ApiOperation({ summary: 'Create a shift' })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateShiftDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.shiftsService.create(user, dto, this.ctx(req));
  }

  @Get()
  @Permissions('shift:read')
  @ApiOperation({ summary: 'List organisation shifts' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: ListShiftsQueryDto,
  ) {
    return this.shiftsService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a shift by ID' })
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shiftsService.findOne(user, id);
  }

  @Patch(':id')
  @Permissions('shift:update')
  @ApiOperation({ summary: 'Update a shift' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShiftDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.shiftsService.update(user, id, dto, this.ctx(req));
  }

  @Patch(':id/status')
  @Permissions('shift:update')
  @ApiOperation({
    summary: 'Update shift status (cancel cascades assignments)',
  })
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShiftStatusDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.shiftsService.updateStatus(user, id, dto, this.ctx(req));
  }

  @Delete(':id')
  @Permissions('shift:archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-archive a shift' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async archive(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { requestId?: string },
  ): Promise<void> {
    await this.shiftsService.archive(user, id, this.ctx(req));
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
