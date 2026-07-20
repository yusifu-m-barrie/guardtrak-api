import { Injectable, Logger } from '@nestjs/common';

/**
 * Phase 9 placeholders for Geo-IP lookup and IP reputation scoring.
 * Wire a real provider (MaxMind, AbuseIPDB, etc.) in production without
 * changing call sites.
 */
@Injectable()
export class SecurityIntelService {
  private readonly logger = new Logger(SecurityIntelService.name);

  /**
   * Returns a coarse geo placeholder. Always `unknown` until a provider is configured.
   */
  lookupGeoIp(ipAddress?: string | null): {
    country: string | null;
    region: string | null;
    provider: 'none';
  } {
    void ipAddress;
    return { country: null, region: null, provider: 'none' };
  }

  /**
   * Returns a neutral reputation score (0–100). Higher is more trusted.
   */
  scoreIpReputation(ipAddress?: string | null): {
    score: number;
    flagged: boolean;
    provider: 'none';
  } {
    void ipAddress;
    return { score: 50, flagged: false, provider: 'none' };
  }

  logSuspiciousRequest(input: {
    reason: string;
    ipAddress?: string | null;
    path?: string;
    userAgent?: string | null;
    requestId?: string | null;
  }): void {
    this.logger.warn(
      `Suspicious request: ${input.reason} ip=${input.ipAddress ?? 'n/a'} path=${input.path ?? 'n/a'} requestId=${input.requestId ?? 'n/a'}`,
    );
  }
}
