import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user.type';
import { ReportsService } from './reports.service';
import { AttendanceHoursQueryDto } from './dto/attendance-hours-query.dto';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @Permissions('report:read')
  @ApiOperation({ summary: 'Organisation operations dashboard aggregates' })
  dashboard(@CurrentUser() user: RequestUser) {
    return this.reportsService.dashboard(user);
  }

  @Get('attendance')
  @Permissions('report:read')
  @ApiOperation({ summary: 'Attendance report aggregates' })
  attendance(@CurrentUser() user: RequestUser) {
    return this.reportsService.attendance(user);
  }

  @Get('attendance-hours')
  @Permissions('report:read')
  @ApiOperation({
    summary:
      'Attendance work-hours reports (clock-out − clock-in − breaks) with filters, pagination, and report views',
  })
  attendanceHours(
    @CurrentUser() user: RequestUser,
    @Query() query: AttendanceHoursQueryDto,
  ) {
    return this.reportsService.attendanceHours(user, query);
  }

  @Get('incidents')
  @Permissions('report:read')
  @ApiOperation({ summary: 'Incidents report aggregates' })
  incidents(@CurrentUser() user: RequestUser) {
    return this.reportsService.incidents(user);
  }

  @Get('patrols')
  @Permissions('report:read')
  @ApiOperation({ summary: 'Patrols report aggregates' })
  patrols(@CurrentUser() user: RequestUser) {
    return this.reportsService.patrols(user);
  }

  @Get('emergency')
  @Permissions('report:read')
  @ApiOperation({ summary: 'Emergency report aggregates' })
  emergency(@CurrentUser() user: RequestUser) {
    return this.reportsService.emergency(user);
  }
}
