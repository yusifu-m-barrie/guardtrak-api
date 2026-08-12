import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { UserRole as AppUserRole } from '../../common/enums/user-role.enum';
import type { RequestUser } from '../../common/types/request-user.type';
import {
  tenantNotFound,
  userHasPermission,
} from '../../common/tenant/tenant.util';
import { PrismaService } from '../../database/prisma/prisma.service';

/** Operational scope for supervisors. `null` means unrestricted (admin). */
export interface SupervisorOperationalScope {
  supervisorProfileId: string;
  officerIds: string[];
  siteIds: string[];
  clientIds: string[];
}

@Injectable()
export class AssignmentAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveOfficerProfileId(
    user: RequestUser,
    organisationId: string,
  ): Promise<string> {
    const officer = await this.prisma.officerProfile.findFirst({
      where: { userId: user.id, organisationId, deletedAt: null },
      select: { id: true },
    });
    if (!officer) {
      throw new AppException(
        'Officer profile not found for authenticated user',
        HttpStatus.FORBIDDEN,
        ErrorCode.ASSIGNMENT_ACCESS_FORBIDDEN,
      );
    }
    return officer.id;
  }

  async resolveSupervisorProfileId(
    user: RequestUser,
    organisationId: string,
  ): Promise<string | null> {
    const supervisor = await this.prisma.supervisorProfile.findFirst({
      where: { userId: user.id, organisationId, deletedAt: null },
      select: { id: true },
    });
    return supervisor?.id ?? null;
  }

  /** Active officer profile IDs linked to this supervisor (empty if none). */
  async listAssignedOfficerIds(
    organisationId: string,
    supervisorProfileId: string,
  ): Promise<string[]> {
    const links = await this.prisma.supervisorOfficer.findMany({
      where: {
        organisationId,
        supervisorId: supervisorProfileId,
        OR: [{ activeUntil: null }, { activeUntil: { gt: new Date() } }],
      },
      select: { officerId: true },
    });
    return links.map((link) => link.officerId);
  }

  /**
   * Admins see everything in the org. Supervisors only see officers on their
   * team plus sites/clients reached via those officers' (or their own) shifts.
   */
  async resolveSupervisorOperationalScope(
    user: RequestUser,
    organisationId: string,
  ): Promise<SupervisorOperationalScope | null> {
    if (user.role !== AppUserRole.SUPERVISOR) {
      return null;
    }

    const supervisorProfileId = await this.resolveSupervisorProfileId(
      user,
      organisationId,
    );
    if (!supervisorProfileId) {
      return {
        supervisorProfileId: '',
        officerIds: [],
        siteIds: [],
        clientIds: [],
      };
    }

    const officerIds = await this.listAssignedOfficerIds(
      organisationId,
      supervisorProfileId,
    );

    const assignmentOr =
      officerIds.length > 0
        ? [
            { supervisorId: supervisorProfileId },
            { officerId: { in: officerIds } },
          ]
        : [{ supervisorId: supervisorProfileId }];

    const shifts = await this.prisma.shift.findMany({
      where: {
        organisationId,
        deletedAt: null,
        assignments: { some: { OR: assignmentOr } },
      },
      select: {
        siteId: true,
        site: { select: { clientId: true } },
      },
      distinct: ['siteId'],
    });

    const patrols =
      officerIds.length > 0
        ? await this.prisma.patrolAssignment.findMany({
            where: {
              organisationId,
              officerId: { in: officerIds },
            },
            select: {
              siteId: true,
              site: { select: { clientId: true } },
            },
            distinct: ['siteId'],
          })
        : [];

    const siteIds = [
      ...new Set([
        ...shifts.map((shift) => shift.siteId),
        ...patrols.map((patrol) => patrol.siteId),
      ]),
    ];
    const clientIds = [
      ...new Set([
        ...shifts.map((shift) => shift.site.clientId),
        ...patrols.map((patrol) => patrol.site.clientId),
      ].filter(Boolean)),
    ];

    return {
      supervisorProfileId,
      officerIds,
      siteIds,
      clientIds,
    };
  }

  /** Prisma `id: { in: ids }` filter; empty list never matches. */
  emptySafeInFilter(ids: string[]): { in: string[] } {
    return { in: ids.length > 0 ? ids : ['__none__'] };
  }

  /**
   * Supervisors may only manage officers on their active team.
   * Returns the supervisor profile id.
   */
  async assertSupervisorMayManageOfficer(
    user: RequestUser,
    organisationId: string,
    officerId: string,
  ): Promise<string> {
    const supervisorProfileId = await this.resolveSupervisorProfileId(
      user,
      organisationId,
    );
    if (!supervisorProfileId) {
      throw new AppException(
        'Supervisor profile required',
        HttpStatus.FORBIDDEN,
        ErrorCode.ASSIGNMENT_ACCESS_FORBIDDEN,
      );
    }
    const officerIds = await this.listAssignedOfficerIds(
      organisationId,
      supervisorProfileId,
    );
    if (!officerIds.includes(officerId)) {
      throw new AppException(
        'You can only assign or manage officers on your team',
        HttpStatus.FORBIDDEN,
        ErrorCode.ASSIGNMENT_ACCESS_FORBIDDEN,
      );
    }
    return supervisorProfileId;
  }

  async assertCanReadAssignment(
    user: RequestUser,
    organisationId: string,
    assignment: {
      officerId: string;
      supervisorId: string | null;
    },
  ): Promise<void> {
    if (user.role === AppUserRole.SUPERVISOR) {
      const supervisorId = await this.resolveSupervisorProfileId(
        user,
        organisationId,
      );
      if (supervisorId && assignment.supervisorId === supervisorId) {
        return;
      }
      if (supervisorId) {
        const linked = await this.prisma.supervisorOfficer.findFirst({
          where: {
            supervisorId,
            officerId: assignment.officerId,
            organisationId,
            OR: [{ activeUntil: null }, { activeUntil: { gt: new Date() } }],
          },
          select: { id: true },
        });
        if (linked) {
          return;
        }
      }
      tenantNotFound(ErrorCode.ASSIGNMENT_NOT_FOUND);
    }

    if (userHasPermission(user, 'assignment:read')) {
      return;
    }

    if (userHasPermission(user, 'assignment:read:self')) {
      const officerId = await this.resolveOfficerProfileId(
        user,
        organisationId,
      );
      if (assignment.officerId === officerId) {
        return;
      }
    }

    tenantNotFound(ErrorCode.ASSIGNMENT_NOT_FOUND);
  }
}
