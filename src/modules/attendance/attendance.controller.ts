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
import { AttendanceReasonDto } from './dto/attendance-reason.dto';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { CorrectAttendanceDto } from './dto/correct-attendance.dto';
import { ListAttendanceQueryDto } from './dto/list-attendance-query.dto';
import { ListMyAttendanceQueryDto } from './dto/list-my-attendance-query.dto';
import { AttendanceService } from './attendance.service';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('clock-in')
  @Permissions('attendance:clock-in:self')
  @ApiOperation({ summary: 'Officer clock-in with geofence validation' })
  clockIn(
    @CurrentUser() user: RequestUser,
    @Body() dto: ClockInDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.attendanceService.clockIn(user, dto, this.ctx(req));
  }

  @Post('clock-out')
  @Permissions('attendance:clock-out:self')
  @ApiOperation({ summary: 'Officer clock-out with server-side totals' })
  clockOut(
    @CurrentUser() user: RequestUser,
    @Body() dto: ClockOutDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.attendanceService.clockOut(user, dto, this.ctx(req));
  }

  @Get('current')
  @Permissions('attendance:read:self')
  @ApiOperation({ summary: 'Current active attendance for officer' })
  getCurrent(@CurrentUser() user: RequestUser) {
    return this.attendanceService.getCurrent(user);
  }

  @Get('me')
  @Permissions('attendance:read:self')
  @ApiOperation({ summary: 'Paginated attendance history for officer' })
  listMine(
    @CurrentUser() user: RequestUser,
    @Query() query: ListMyAttendanceQueryDto,
  ) {
    return this.attendanceService.listMine(user, query);
  }

  @Get()
  @Permissions('attendance:read')
  @ApiOperation({ summary: 'List organisation attendance records' })
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListAttendanceQueryDto,
  ) {
    return this.attendanceService.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get attendance by ID' })
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.attendanceService.findOne(user, id);
  }

  @Post(':id/request-review')
  @Permissions('attendance:read:self')
  @ApiOperation({ summary: 'Officer requests attendance review' })
  requestReview(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttendanceReasonDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.attendanceService.requestReview(user, id, dto, this.ctx(req));
  }

  @Post(':id/approve')
  @Permissions('attendance:approve')
  @ApiOperation({ summary: 'Approve attendance' })
  approve(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttendanceReasonDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.attendanceService.approve(user, id, dto, this.ctx(req));
  }

  @Post(':id/reject')
  @Permissions('attendance:review')
  @ApiOperation({ summary: 'Reject attendance' })
  reject(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttendanceReasonDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.attendanceService.reject(user, id, dto, this.ctx(req));
  }

  @Post(':id/correct')
  @Permissions('attendance:correct')
  @ApiOperation({ summary: 'Correct attendance timestamps and recalculate' })
  correct(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CorrectAttendanceDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.attendanceService.correct(user, id, dto, this.ctx(req));
  }

  @Post(':id/void')
  @Permissions('attendance:void')
  @ApiOperation({ summary: 'Void attendance (administrator)' })
  voidAttendance(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttendanceReasonDto,
    @Req() req: Request & { requestId?: string },
  ) {
    return this.attendanceService.voidAttendance(user, id, dto, this.ctx(req));
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
