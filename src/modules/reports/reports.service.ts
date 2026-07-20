import { Injectable } from '@nestjs/common';
import {
  AttendanceStatus,
  EmergencyStatus,
  IncidentStatus,
  PatrolAssignmentStatus,
} from '../../../generated/prisma/client';
import type { RequestUser } from '../../common/types/request-user.type';
import { requireOrganisationId } from '../../common/tenant/tenant.util';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(user: RequestUser) {
    const organisationId = requireOrganisationId(user);
    const [
      openIncidents,
      activeEmergencies,
      openSupport,
      patrolInProgress,
      attendanceClockedIn,
    ] = await this.prisma.$transaction([
      this.prisma.incident.count({
        where: {
          organisationId,
          deletedAt: null,
          status: {
            notIn: [
              IncidentStatus.CLOSED,
              IncidentStatus.REJECTED,
              IncidentStatus.RESOLVED,
            ],
          },
        },
      }),
      this.prisma.emergency.count({
        where: {
          organisationId,
          status: {
            in: [
              EmergencyStatus.CREATED,
              EmergencyStatus.ACCEPTED_FOR_PROCESSING,
              EmergencyStatus.ACKNOWLEDGED,
              EmergencyStatus.RESPONDING,
            ],
          },
        },
      }),
      this.prisma.supportRequest.count({
        where: {
          organisationId,
          status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.patrolAssignment.count({
        where: {
          organisationId,
          status: PatrolAssignmentStatus.IN_PROGRESS,
        },
      }),
      this.prisma.attendance.count({
        where: {
          organisationId,
          status: AttendanceStatus.CLOCKED_IN,
        },
      }),
    ]);
    return {
      openIncidents,
      activeEmergencies,
      openSupportRequests: openSupport,
      patrolsInProgress: patrolInProgress,
      officersClockedIn: attendanceClockedIn,
    };
  }

  async attendance(user: RequestUser) {
    const organisationId = requireOrganisationId(user);
    const byStatus = await this.prisma.attendance.groupBy({
      by: ['status'],
      where: { organisationId },
      _count: { _all: true },
    });
    return {
      byStatus: Object.fromEntries(
        byStatus.map((g) => [g.status, g._count._all]),
      ),
      export: this.exportStub('attendance'),
    };
  }

  async incidents(user: RequestUser) {
    const organisationId = requireOrganisationId(user);
    const byStatus = await this.prisma.incident.groupBy({
      by: ['status'],
      where: { organisationId, deletedAt: null },
      _count: { _all: true },
    });
    const bySeverity = await this.prisma.incident.groupBy({
      by: ['severity'],
      where: { organisationId, deletedAt: null },
      _count: { _all: true },
    });
    return {
      byStatus: Object.fromEntries(
        byStatus.map((g) => [g.status, g._count._all]),
      ),
      bySeverity: Object.fromEntries(
        bySeverity.map((g) => [g.severity, g._count._all]),
      ),
      export: this.exportStub('incidents'),
    };
  }

  async patrols(user: RequestUser) {
    const organisationId = requireOrganisationId(user);
    const byStatus = await this.prisma.patrolAssignment.groupBy({
      by: ['status'],
      where: { organisationId },
      _count: { _all: true },
    });
    return {
      byStatus: Object.fromEntries(
        byStatus.map((g) => [g.status, g._count._all]),
      ),
      export: this.exportStub('patrols'),
    };
  }

  async emergency(user: RequestUser) {
    const organisationId = requireOrganisationId(user);
    const byStatus = await this.prisma.emergency.groupBy({
      by: ['status'],
      where: { organisationId },
      _count: { _all: true },
    });
    return {
      byStatus: Object.fromEntries(
        byStatus.map((g) => [g.status, g._count._all]),
      ),
      export: this.exportStub('emergency'),
    };
  }

  private exportStub(reportType: string) {
    return {
      exportFormat: 'csv' as const,
      status: 'not_implemented' as const,
      message: `CSV/PDF export for ${reportType} is deferred to Phase 8`,
    };
  }
}
