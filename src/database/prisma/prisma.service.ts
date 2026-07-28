import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../../../generated/prisma/client';

function isDirectPostgresUrl(url: string): boolean {
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

/** Ensure Prisma gets an explicit schema for Railway/managed Postgres URLs. */
function withPublicSchema(url: string): string {
  if (!url || /[?&]schema=/.test(url)) {
    return url;
  }
  return url.includes('?') ? `${url}&schema=public` : `${url}?schema=public`;
}

/**
 * Railway public proxy hosts require TLS. Private `*.railway.internal` URLs do not.
 */
function resolvePoolSsl(
  url: string,
): { rejectUnauthorized: boolean } | undefined {
  if (/sslmode=disable/i.test(url)) {
    return undefined;
  }
  if (/sslmode=require/i.test(url)) {
    return { rejectUnauthorized: false };
  }
  if (/railway\.app|rlwy\.net|proxy\.rlwy\.net/i.test(url)) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;
  private readonly directPostgres: boolean;
  private connected = false;

  constructor(private readonly configService: ConfigService) {
    const connectionString = configService.get<string>('database.url');

    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured');
    }

    const directPostgres = isDirectPostgresUrl(connectionString);
    // PrismaPg requires a direct TCP URL. prisma+postgres:// is CLI/Accelerate only.
    const adapterUrl = directPostgres
      ? withPublicSchema(connectionString)
      : 'postgresql://127.0.0.1:1/guardtrak_unconfigured';

    const pool = new Pool({
      connectionString: adapterUrl,
      ssl: resolvePoolSsl(adapterUrl),
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      max: 10,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
    this.directPostgres = directPostgres;

    if (!directPostgres) {
      this.logger.error(
        'DATABASE_URL must be a direct postgres:// or postgresql:// URL for the NestJS runtime. ' +
          'prisma+postgres:// and prisma:// URLs are not supported by @prisma/adapter-pg. ' +
          'See docs/environment.md.',
      );
    }
  }

  async onModuleInit(): Promise<void> {
    const nodeEnv = this.configService.get<string>('app.nodeEnv');

    if (!this.directPostgres) {
      this.connected = false;
      if (nodeEnv === 'production' || nodeEnv === 'staging') {
        throw new Error(
          'DATABASE_URL must be a direct PostgreSQL URL in staging/production',
        );
      }
      this.logger.warn(
        'Skipping database connection until a direct PostgreSQL URL is configured',
      );
      return;
    }

    try {
      await this.$connect();
      const healthy = await this.isHealthy();
      if (!healthy) {
        throw new Error('Database ping failed after connect');
      }
      this.connected = true;
      this.logger.log('Prisma connected to PostgreSQL');
    } catch (error) {
      this.connected = false;
      this.logger.error(
        'Prisma failed to connect to PostgreSQL',
        error instanceof Error ? error.stack : undefined,
      );

      if (nodeEnv === 'production' || nodeEnv === 'staging') {
        throw error;
      }

      this.logger.warn(
        'Continuing without an active database connection (non-production). Health checks will report unhealthy.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.connected) {
        await this.$disconnect();
      }
    } finally {
      await this.pool.end();
      this.logger.log('Prisma disconnected from PostgreSQL');
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.directPostgres) {
      return false;
    }

    try {
      const result = await this.pool.query('SELECT 1 AS ok');
      this.connected = (result.rowCount ?? result.rows.length) > 0;
      return this.connected;
    } catch (error) {
      this.connected = false;
      this.logger.warn(
        `Database health check failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return false;
    }
  }
}
