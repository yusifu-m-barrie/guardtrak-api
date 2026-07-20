import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe (process up, no dependencies)' })
  live() {
    return this.healthService.live();
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Application liveness and dependency status' })
  async check(@Res({ passthrough: true }) res: Response) {
    const result = await this.healthService.check();

    if (result.status !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return result;
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (database and redis required)' })
  async ready(@Res({ passthrough: true }) res: Response) {
    const result = await this.healthService.readiness();

    if (result.status !== 'ready') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return result;
  }
}
