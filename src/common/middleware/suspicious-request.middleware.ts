import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { SecurityIntelService } from '../security/security-intel.service';

/**
 * Soft security signal middleware — never blocks; logs anomalies for ops.
 */
@Injectable()
export class SuspiciousRequestMiddleware implements NestMiddleware {
  constructor(private readonly intel: SecurityIntelService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const ua = req.headers['user-agent'];
    const contentLength = Number(req.headers['content-length'] ?? 0);
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ?? req.ip;

    if (!ua || ua.length < 3) {
      this.intel.logSuspiciousRequest({
        reason: 'missing_or_short_user_agent',
        ipAddress: ip,
        path: req.path,
        userAgent: typeof ua === 'string' ? ua : null,
        requestId: req.headers['x-request-id'] as string | undefined,
      });
    }

    if (contentLength > 52_428_800) {
      this.intel.logSuspiciousRequest({
        reason: 'oversized_content_length',
        ipAddress: ip,
        path: req.path,
        requestId: req.headers['x-request-id'] as string | undefined,
      });
    }

    // Touch placeholders so they stay wired for future providers
    this.intel.lookupGeoIp(ip);
    this.intel.scoreIpReputation(ip);

    next();
  }
}
