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
