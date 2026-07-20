import { Injectable, Logger, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { redactObject } from '../utils/redact.util';

/**
 * Thin logging abstraction over NestJS Logger.
 * Prepared for structured logging adapters later.
 */
@Injectable()
export class AppLoggerService {
  private readonly logger = new Logger('App');

  constructor(private readonly configService: ConfigService) {
    const level = this.configService.get<string>('app.logLevel') ?? 'log';
    const levels = this.resolveLevels(level);
    Logger.overrideLogger(levels);
  }

  log(message: string, context?: string, meta?: Record<string, unknown>): void {
    this.logger.log(this.format(message, meta), context);
  }

  warn(
    message: string,
    context?: string,
    meta?: Record<string, unknown>,
  ): void {
    this.logger.warn(this.format(message, meta), context);
  }

  error(
    message: string,
    trace?: string,
    context?: string,
    meta?: Record<string, unknown>,
  ): void {
    this.logger.error(this.format(message, meta), trace, context);
  }

  debug(
    message: string,
    context?: string,
    meta?: Record<string, unknown>,
  ): void {
    this.logger.debug(this.format(message, meta), context);
  }

  private format(message: string, meta?: Record<string, unknown>): string {
    if (!meta) {
      return message;
    }
    const safe = redactObject(meta);
    return `${message} ${JSON.stringify(safe)}`;
  }

  private resolveLevels(level: string): LogLevel[] {
    switch (level) {
      case 'error':
        return ['error'];
      case 'warn':
        return ['error', 'warn'];
      case 'debug':
        return ['error', 'warn', 'log', 'debug'];
      case 'verbose':
        return ['error', 'warn', 'log', 'debug', 'verbose'];
      case 'log':
      default:
        return ['error', 'warn', 'log'];
    }
  }
}
