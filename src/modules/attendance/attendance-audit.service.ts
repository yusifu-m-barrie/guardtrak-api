import { Injectable } from '@nestjs/common';
import { AuditAction, type Prisma } from '../../../generated/prisma/client';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import type { ServiceRequestContext } from '../clients/clients.types';

@Injectable()
export class AttendanceAuditService {
  constructor(private readonly auditService: AuthAuditService) {}

  async record(
    input: {
      organisationId: string;
      actorUserId: string;
      action: AuditAction;
      entityId: string;
      metadata?: Prisma.InputJsonValue;
    },
    ctx: ServiceRequestContext,
  ): Promise<void> {
    await this.auditService.record({
      organisationId: input.organisationId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: 'Attendance',
      entityId: input.entityId,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: input.metadata,
    });
  }
}
