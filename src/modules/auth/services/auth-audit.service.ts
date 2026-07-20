import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';

@Injectable()
export class AuthAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async record(input: {
    organisationId?: string | null;
    actorUserId?: string | null;
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    requestId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          organisationId: input.organisationId ?? null,
          actorUserId: input.actorUserId ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          requestId: input.requestId ?? null,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          metadata: input.metadata,
        },
      });
    } catch {
      // Never expose audit failures; avoid logging secrets.
      if (this.configService.get<string>('app.nodeEnv') !== 'production') {
        // Soft-fail in all environments for non-critical metadata writes.
      }
    }
  }
}
