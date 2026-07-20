import { Controller, Get, Post, Headers } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user.type';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Permissions('platform:manage')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('system')
  @ApiOperation({ summary: 'Platform system overview (SUPER_ADMIN)' })
  getSystem() {
    return this.adminService.getSystem();
  }

  @Get('system-health')
  @ApiOperation({ summary: 'Aggregated health + readiness' })
  getSystemHealth() {
    return this.adminService.getSystemHealth();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Metrics summary for operators' })
  getMetrics() {
    return this.adminService.getMetricsSummary();
  }

  @Get('cache')
  @ApiOperation({ summary: 'Cache backend stats' })
  getCache() {
    return this.adminService.getCache();
  }

  @Post('cache/clear')
  @ApiOperation({ summary: 'Clear application cache' })
  clearCache(
    @CurrentUser() user: RequestUser,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.adminService.clearCache(user, requestId);
  }

  @Get('storage')
  @ApiOperation({ summary: 'Storage usage overview' })
  getStorage() {
    return this.adminService.getStorageOverview();
  }

  @Get('queues')
  @ApiOperation({ summary: 'Queue metrics' })
  getQueues() {
    return this.adminService.getQueues();
  }

  @Post('queues/pause')
  @ApiOperation({ summary: 'Pause queue processing flag (placeholder)' })
  pauseQueues(
    @CurrentUser() user: RequestUser,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.adminService.pauseQueues(user, requestId);
  }

  @Post('queues/resume')
  @ApiOperation({ summary: 'Resume queue processing flag' })
  resumeQueues(
    @CurrentUser() user: RequestUser,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.adminService.resumeQueues(user, requestId);
  }

  @Post('queues/retry')
  @ApiOperation({ summary: 'Enqueue DLQ retry cleanup job' })
  retryQueues(
    @CurrentUser() user: RequestUser,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.adminService.retryQueues(user, requestId);
  }

  @Get('background-jobs')
  @ApiOperation({ summary: 'Known background job catalogue' })
  getBackgroundJobs() {
    return this.adminService.getBackgroundJobs();
  }
}
