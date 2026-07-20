import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import type { RequestUser } from '../../common/types/request-user.type';
import {
  tenantNotFound,
  userHasPermission,
} from '../../common/tenant/tenant.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AssignmentAccessService } from '../assignments/assignment-access.service';

@Injectable()
export class PatrolAccessService {
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

  async assertCanReadPatrolAssignment(
    user: RequestUser,
    organisationId: string,
    patrol: { officerId: string; siteId: string },
  ): Promise<void> {
    if (userHasPermission(user, 'patrol-assignment:read')) {
      return;
    }
    if (userHasPermission(user, 'patrol-assignment:read:self')) {
      const officerId = await this.resolveOfficerProfileId(
        user,
        organisationId,
      );
      if (officerId === patrol.officerId) {
        return;
      }
    }
    const supervisorId = await this.resolveSupervisorProfileId(
      user,
      organisationId,
    );
    if (supervisorId) {
      const linked = await this.prisma.supervisorOfficer.findFirst({
        where: {
          supervisorId,
          officerId: patrol.officerId,
          organisationId,
          OR: [{ activeUntil: null }, { activeUntil: { gt: new Date() } }],
        },
      });
      if (linked) {
        return;
      }
    }
    tenantNotFound(ErrorCode.PATROL_ASSIGNMENT_NOT_FOUND);
  }

  async assertCanReviewPatrol(
    user: RequestUser,
    organisationId: string,
    patrol: { officerId: string },
  ): Promise<void> {
    if (
      userHasPermission(user, 'patrol-visit:override') ||
      userHasPermission(user, 'patrol-assignment:review')
    ) {
      const supervisorId = await this.resolveSupervisorProfileId(
        user,
        organisationId,
      );
      if (!supervisorId && userHasPermission(user, 'patrol-visit:override')) {
        return;
      }
      if (supervisorId) {
        const linked = await this.prisma.supervisorOfficer.findFirst({
          where: {
            supervisorId,
            officerId: patrol.officerId,
            organisationId,
            OR: [{ activeUntil: null }, { activeUntil: { gt: new Date() } }],
          },
        });
        if (linked || userHasPermission(user, 'patrol-visit:override')) {
          return;
        }
      }
      if (userHasPermission(user, 'patrol-visit:override')) {
        return;
      }
    }
    throw new AppException(
      'Not authorised to review this patrol',
      HttpStatus.FORBIDDEN,
      ErrorCode.PATROL_VISIT_REVIEW_FORBIDDEN,
    );
  }
}
