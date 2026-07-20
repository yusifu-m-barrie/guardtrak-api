import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { UserRole } from '../../common/enums/user-role.enum';
import { ErrorCode } from '../../common/constants/error-codes';
import type { RequestUser } from '../../common/types/request-user.type';
import {
  tenantNotFound,
  userHasPermission,
} from '../../common/tenant/tenant.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AssignmentAccessService } from '../assignments/assignment-access.service';

@Injectable()
export class IncidentAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentAccess: AssignmentAccessService,
  ) {}

  resolveOfficerProfileId(user: RequestUser, organisationId: string) {
    return this.assignmentAccess.resolveOfficerProfileId(user, organisationId);
  }

  resolveSupervisorProfileId(user: RequestUser, organisationId: string) {
    return this.assignmentAccess.resolveSupervisorProfileId(
      user,
      organisationId,
    );
  }

  async assertCanReadIncident(
    user: RequestUser,
    organisationId: string,
    incident: {
      reportedByOfficerId: string;
      reportedByUserId: string;
      assignedSupervisorId: string | null;
    },
  ): Promise<void> {
    if (
      userHasPermission(user, 'incident:manage') ||
      user.role === UserRole.ADMINISTRATOR
    ) {
      return;
    }
    if (
      userHasPermission(user, 'incident:read:self') &&
      incident.reportedByUserId === user.id
    ) {
      return;
    }
    if (
      userHasPermission(user, 'incident:read') ||
      userHasPermission(user, 'incident:read:assigned')
    ) {
      if (incident.assignedSupervisorId === user.id) {
        return;
      }
      const supervisorId = await this.resolveSupervisorProfileId(
        user,
        organisationId,
      );
      if (supervisorId) {
        const linked = await this.prisma.supervisorOfficer.findFirst({
          where: {
            supervisorId,
            officerId: incident.reportedByOfficerId,
            organisationId,
            OR: [{ activeUntil: null }, { activeUntil: { gt: new Date() } }],
          },
        });
        if (linked) {
          return;
        }
      }
      if (userHasPermission(user, 'incident:manage')) {
        return;
      }
    }
    tenantNotFound(ErrorCode.INCIDENT_NOT_FOUND);
  }

  async assertCanManageIncident(
    user: RequestUser,
    organisationId: string,
    incident: {
      reportedByOfficerId: string;
      assignedSupervisorId: string | null;
    },
  ): Promise<void> {
    if (
      userHasPermission(user, 'incident:manage') ||
      user.role === UserRole.ADMINISTRATOR
    ) {
      return;
    }
    const managePerms = [
      'incident:assign',
      'incident:close',
      'incident:reopen',
      'incident:escalate',
      'incident:update',
      'incident:acknowledge',
      'incident:dispatch',
      'incident:note',
    ];
    if (!managePerms.some((p) => userHasPermission(user, p))) {
      tenantNotFound(ErrorCode.INCIDENT_NOT_FOUND);
    }
    if (incident.assignedSupervisorId === user.id) {
      return;
    }
    const supervisorId = await this.resolveSupervisorProfileId(
      user,
      organisationId,
    );
    if (supervisorId) {
      const linked = await this.prisma.supervisorOfficer.findFirst({
        where: {
          supervisorId,
          officerId: incident.reportedByOfficerId,
          organisationId,
          OR: [{ activeUntil: null }, { activeUntil: { gt: new Date() } }],
        },
      });
      if (linked) {
        return;
      }
    }
    tenantNotFound(ErrorCode.INCIDENT_NOT_FOUND);
  }

  async listScopeWhere(
    user: RequestUser,
    organisationId: string,
  ): Promise<Prisma.IncidentWhereInput> {
    if (
      userHasPermission(user, 'incident:manage') ||
      user.role === UserRole.ADMINISTRATOR
    ) {
      return { organisationId, deletedAt: null };
    }
    if (
      userHasPermission(user, 'incident:read:assigned') ||
      userHasPermission(user, 'incident:read')
    ) {
      const supervisorId = await this.resolveSupervisorProfileId(
        user,
        organisationId,
      );
      const officerIds: string[] = [];
      if (supervisorId) {
        const links = await this.prisma.supervisorOfficer.findMany({
          where: {
            supervisorId,
            organisationId,
            OR: [{ activeUntil: null }, { activeUntil: { gt: new Date() } }],
          },
          select: { officerId: true },
        });
        officerIds.push(...links.map((l) => l.officerId));
      }
      return {
        organisationId,
        deletedAt: null,
        OR: [
          { assignedSupervisorId: user.id },
          ...(officerIds.length
            ? [{ reportedByOfficerId: { in: officerIds } }]
            : []),
          { reportedByUserId: user.id },
        ],
      };
    }
    return {
      organisationId,
      deletedAt: null,
      reportedByUserId: user.id,
    };
  }
}
