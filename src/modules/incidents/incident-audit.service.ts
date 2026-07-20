import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '../../../generated/prisma/client';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import type { ServiceRequestContext } from '../clients/clients.types';

@Injectable()
export class IncidentAuditService {
  constructor(private readonly auditService: AuthAuditService) {}

  record(
    params: {
      organisationId: string;
      actorUserId: string;
      action: AuditAction;
      entityId: string;
      metadata?: Prisma.InputJsonValue;
    },
    ctx: ServiceRequestContext,
  ) {
    return this.auditService.record({
      organisationId: params.organisationId,
      actorUserId: params.actorUserId,
      action: params.action,
      entityType: 'Incident',
      entityId: params.entityId,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: params.metadata,
    });
  }
}
