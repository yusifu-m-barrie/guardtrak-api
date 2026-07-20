import { Injectable } from '@nestjs/common';
import { AuditAction } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ErrorCode } from '../../common/constants/error-codes';
import {
  requireOrganisationId,
  tenantNotFound,
} from '../../common/tenant/tenant.util';
import type { RequestUser } from '../../common/types/request-user.type';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import {
  normalizeEmail,
  normalizePersonName,
  normalizePhone,
  trimOrUndefined,
} from '../../common/utils/normalize.util';
import { mapOrganisationSummary } from './mappers/organisation.mapper';
import type { UpdateOrganisationDto } from './dto/update-organisation.dto';

export interface AuditRequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

@Injectable()
export class OrganisationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authAuditService: AuthAuditService,
  ) {}

  async getSelf(actor: RequestUser) {
    const organisationId = requireOrganisationId(actor);
    const organisation = await this.findActiveOrganisation(organisationId);
    return mapOrganisationSummary(organisation);
  }

  async updateSelf(
    actor: RequestUser,
    dto: UpdateOrganisationDto,
    ctx: AuditRequestContext,
  ) {
    const organisationId = requireOrganisationId(actor);
    const existing = await this.findActiveOrganisation(organisationId);

    const updated = await this.prisma.organisation.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined
          ? { name: normalizePersonName(dto.name) }
          : {}),
        ...(dto.legalName !== undefined
          ? { legalName: trimOrUndefined(dto.legalName) ?? null }
          : {}),
        ...(dto.registrationNumber !== undefined
          ? {
              registrationNumber:
                trimOrUndefined(dto.registrationNumber) ?? null,
            }
          : {}),
        ...(dto.email !== undefined
          ? { email: normalizeEmail(dto.email) }
          : {}),
        ...(dto.phone !== undefined
          ? { phone: normalizePhone(dto.phone) }
          : {}),
        ...(dto.address !== undefined
          ? { address: trimOrUndefined(dto.address) ?? null }
          : {}),
        ...(dto.countryCode !== undefined
          ? { countryCode: dto.countryCode.trim().toUpperCase() }
          : {}),
        ...(dto.timezone !== undefined
          ? { timezone: trimOrUndefined(dto.timezone) ?? existing.timezone }
          : {}),
        ...(dto.logoUrl !== undefined
          ? { logoUrl: trimOrUndefined(dto.logoUrl) ?? null }
          : {}),
      },
    });

    await this.authAuditService.record({
      organisationId,
      actorUserId: actor.id,
      action: AuditAction.UPDATE,
      entityType: 'Organisation',
      entityId: updated.id,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        changedFields: Object.keys(dto).filter(
          (key) => dto[key as keyof UpdateOrganisationDto] !== undefined,
        ),
      },
    });

    return mapOrganisationSummary(updated);
  }

  private async findActiveOrganisation(organisationId: string) {
    const organisation = await this.prisma.organisation.findFirst({
      where: {
        id: organisationId,
        deletedAt: null,
      },
    });

    if (!organisation) {
      tenantNotFound(ErrorCode.ORG_NOT_FOUND);
    }

    return organisation;
  }
}
