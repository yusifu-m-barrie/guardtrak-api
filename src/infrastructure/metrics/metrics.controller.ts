import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Prometheus metrics scrape endpoint' })
  @Header('Content-Type', 'text/plain; charset=utf-8')
  getMetrics(@Res({ passthrough: true }) res: Response): string {
    if (!this.isMetricsEnabled()) {
      throw new NotFoundException();
    }

    const body = this.metricsService.toPrometheus();
    res.status(200);
    return body;
  }

  private isMetricsEnabled(): boolean {
    const envFlag = process.env.METRICS_ENABLED;
    if (envFlag !== undefined && envFlag !== '') {
      return ['true', '1', 'yes', 'on'].includes(envFlag.toLowerCase());
    }
    const nested = this.configService.get<boolean>(
      'observability.metricsEnabled',
    );
    if (nested === true) {
      return true;
    }
    if (nested === false) {
      return false;
    }
    return true;
  }
}
