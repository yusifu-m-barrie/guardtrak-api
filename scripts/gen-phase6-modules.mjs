/**
 * Generates Phase 6 NestJS patrol module scaffolding + core services.
 * Run: node scripts/gen-phase6-modules.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
function write(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/\r\n/g, '\n'), 'utf8');
  console.log('wrote', rel);
}

// Progress service
write(
  'src/modules/patrols/patrol-progress.service.ts',
  `import { Injectable } from '@nestjs/common';
import {
  CheckpointStatus,
  type PatrolAssignmentCheckpoint,
  type PatrolVisit,
} from '../../../generated/prisma/client';

export interface PatrolProgressResult {
  totalCheckpoints: number;
  completedCheckpoints: number;
  pendingCheckpoints: number;
  missedCheckpoints: number;
  skippedCheckpoints: number;
  reviewRequiredCheckpoints: number;
  completionPercentage: number;
  nextCheckpoint: PatrolAssignmentCheckpoint | null;
  allRequiredComplete: boolean;
}

@Injectable()
export class PatrolProgressService {
  calculate(
    snapshots: PatrolAssignmentCheckpoint[],
    visits: Pick<
      PatrolVisit,
      'assignmentCheckpointId' | 'status' | 'patrolCheckpointId'
    >[],
  ): PatrolProgressResult {
    const ordered = [...snapshots].sort((a, b) => a.sequence - b.sequence);
    const visitBySnap = new Map(
      visits
        .filter((v) => v.assignmentCheckpointId)
        .map((v) => [v.assignmentCheckpointId!, v.status]),
    );

    let completed = 0;
    let missed = 0;
    let skipped = 0;
    let review = 0;
    let next: PatrolAssignmentCheckpoint | null = null;

    for (const snap of ordered) {
      const status = visitBySnap.get(snap.id);
      if (status === CheckpointStatus.COMPLETED) {
        completed += 1;
        continue;
      }
      if (status === CheckpointStatus.MISSED) {
        missed += 1;
        continue;
      }
      if (status === CheckpointStatus.SKIPPED) {
        skipped += 1;
        continue;
      }
      if (
        status === CheckpointStatus.REQUIRES_REVIEW ||
        status === CheckpointStatus.OUTSIDE_GEOFENCE
      ) {
        review += 1;
        if (!next) {
          next = snap;
        }
        continue;
      }
      if (!next) {
        next = snap;
      }
    }

    const total = ordered.length;
    const pending = Math.max(0, total - completed - missed - skipped);
    const completionPercentage =
      total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100));

    return {
      totalCheckpoints: total,
      completedCheckpoints: completed,
      pendingCheckpoints: pending,
      missedCheckpoints: missed,
      skippedCheckpoints: skipped,
      reviewRequiredCheckpoints: review,
      completionPercentage,
      nextCheckpoint: next,
      allRequiredComplete: total > 0 && completed === total,
    };
  }
}
`,
);

write(
  'src/modules/patrols/patrol-access.service.ts',
  `import { HttpStatus, Injectable } from '@nestjs/common';
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
      const officerId = await this.resolveOfficerProfileId(user, organisationId);
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
`,
);

write(
  'src/modules/patrols/patrols.module.ts',
  `import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssignmentsModule } from '../assignments/assignments.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { PatrolAccessService } from './patrol-access.service';
import { PatrolProgressService } from './patrol-progress.service';
import { PatrolRoutesModule } from '../patrol-routes/patrol-routes.module';
import { PatrolCheckpointsModule } from '../patrol-checkpoints/patrol-checkpoints.module';
import { PatrolAssignmentsModule } from '../patrol-assignments/patrol-assignments.module';
import { PatrolVisitsModule } from '../patrol-visits/patrol-visits.module';

@Module({
  imports: [
    AuthModule,
    AssignmentsModule,
    AttendanceModule,
    PatrolRoutesModule,
    PatrolCheckpointsModule,
    PatrolAssignmentsModule,
    PatrolVisitsModule,
  ],
  providers: [PatrolAccessService, PatrolProgressService],
  exports: [
    PatrolAccessService,
    PatrolProgressService,
    PatrolRoutesModule,
    PatrolCheckpointsModule,
    PatrolAssignmentsModule,
    PatrolVisitsModule,
  ],
})
export class PatrolsModule {}
`,
);

console.log('shared patrol files done');
