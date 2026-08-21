import { Injectable } from '@nestjs/common';
import {
  AttendanceStatus,
  EmergencyStatus,
  IncidentStatus,
  PatrolAssignmentStatus,
  Prisma,
} from '../../../generated/prisma/client';
import { UserRole as AppUserRole } from '../../common/enums/user-role.enum';
import type { RequestUser } from '../../common/types/request-user.type';
import { requireOrganisationId } from '../../common/tenant/tenant.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AssignmentAccessService } from '../assignments/assignment-access.service';
import { AttendanceCalculationService } from '../attendance/attendance-calculation.service';
import {
  ATTENDANCE_REPORT_TYPES,
  type AttendanceHoursBasis,
  type AttendanceHoursQueryDto,
  type AttendanceReportType,
} from './dto/attendance-hours-query.dto';
import { buildPaginationMeta } from '../../common/dto/pagination-meta.dto';
import { normalisePagination } from '../../common/utils/pagination.util';
import {
  dateKeyToUtcDate,
  endOfZonedDay,
  parseDateKey,
  startOfZonedDay,
  zonedDateKey,
} from '../../common/utils/timezone.util';
import { expandOccurrences } from '../shifts/shift-recurrence.util';

type AttendanceReportRecord = {
  id: string;
  officerId: string;
  siteId: string;
  shiftId: string;
  status: AttendanceStatus;
  clockInServerAt: Date | null;
  clockOutServerAt: Date | null;
  totalBreakMinutes: number;
  grossMinutes: number | null;
  payableMinutes: number | null;
  overtimeMinutes: number | null;
  lateMinutes: number | null;
  earlyDepartureMinutes: number | null;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  officer: {
    officerNumber: string;
    user: {
      employeeId: string;
      firstName: string;
      lastName: string;
      displayName: string | null;
    } | null;
  } | null;
  site: { name: string; code: string } | null;
  shift: { title: string; scheduledStartAt: Date; scheduledEndAt: Date } | null;
  assignment: { supervisorId: string | null } | null;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentAccess: AssignmentAccessService,
    private readonly attendanceCalculation: AttendanceCalculationService,
  ) {}

  async dashboard(user: RequestUser) {
    const organisationId = requireOrganisationId(user);
    const officerScope = await this.supervisorOfficerScope(
      user,
      organisationId,
    );
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
          ...(officerScope
            ? {
                OR: [
                  { assignedSupervisorId: user.id },
                  { reportedByOfficerId: { in: officerScope } },
                  { reportedByUserId: user.id },
                ],
              }
            : {}),
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
          ...(officerScope ? { officerId: { in: officerScope } } : {}),
        },
      }),
      this.prisma.supportRequest.count({
        where: {
          organisationId,
          status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
          ...(officerScope ? { userId: user.id } : {}),
        },
      }),
      this.prisma.patrolAssignment.count({
        where: {
          organisationId,
          status: PatrolAssignmentStatus.IN_PROGRESS,
          ...(officerScope ? { officerId: { in: officerScope } } : {}),
        },
      }),
      this.prisma.attendance.count({
        where: {
          organisationId,
          status: AttendanceStatus.CLOCKED_IN,
          ...(officerScope ? { officerId: { in: officerScope } } : {}),
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
    const officerScope = await this.supervisorOfficerScope(
      user,
      organisationId,
    );
    const byStatus = await this.prisma.attendance.groupBy({
      by: ['status'],
      where: {
        organisationId,
        ...(officerScope ? { officerId: { in: officerScope } } : {}),
      },
      _count: { _all: true },
    });
    return {
      byStatus: Object.fromEntries(
        byStatus.map((g) => [g.status, g._count._all]),
      ),
      export: this.exportStub('attendance'),
    };
  }

  async attendanceHours(user: RequestUser, query: AttendanceHoursQueryDto) {
    const organisationId = requireOrganisationId(user);
    const officerScope = await this.supervisorOfficerScope(
      user,
      organisationId,
    );
    const organisation = await this.prisma.organisation.findFirst({
      where: { id: organisationId, deletedAt: null },
      select: { id: true, name: true, timezone: true },
    });
    const timeZone = organisation?.timezone ?? 'UTC';
    const fromDate = this.parseRangeStart(query.from, timeZone);
    const toDate = this.parseRangeEnd(query.to, timeZone);
    const reportType = this.resolveReportType(query.reportType);
    const hoursBasis = this.resolveHoursBasis(query.hoursBasis);
    const officerIds = this.resolveOfficerIds(query);

    if (
      Number.isNaN(fromDate.getTime()) ||
      Number.isNaN(toDate.getTime()) ||
      fromDate.getTime() > toDate.getTime()
    ) {
      return this.emptyAttendanceHoursResponse(query, reportType, hoursBasis);
    }

    const approvedOnly =
      query.approvedOnly === 'true' || query.approvedOnly === '1';
    const occurrenceFromKey = (() => {
      const parsed = parseDateKey(query.from);
      if (!parsed) {
        return zonedDateKey(fromDate, timeZone);
      }
      return `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`;
    })();
    const occurrenceToKey = (() => {
      const parsed = parseDateKey(query.to);
      if (!parsed) {
        return zonedDateKey(toDate, timeZone);
      }
      return `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`;
    })();
    const where: Prisma.AttendanceWhereInput = {
      organisationId,
      deletedAt: null,
      clockOutServerAt: { not: null },
      // Match either clock-in time in range OR shift occurrence calendar date
      // so overnight / timezone-boundary shifts still appear for payroll.
      OR: [
        { clockInServerAt: { gte: fromDate, lte: toDate } },
        {
          occurrenceDate: {
            gte: dateKeyToUtcDate(occurrenceFromKey),
            lte: dateKeyToUtcDate(occurrenceToKey),
          },
        },
      ],
      ...(officerScope ? { officerId: { in: officerScope } } : {}),
      ...(officerIds.length === 1
        ? { officerId: officerIds[0] }
        : officerIds.length > 1
          ? { officerId: { in: officerIds } }
          : {}),
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.shiftId ? { shiftId: query.shiftId } : {}),
      ...(query.supervisorId
        ? { assignment: { supervisorId: query.supervisorId } }
        : {}),
      ...(query.status
        ? { status: query.status }
        : approvedOnly
          ? {
              status: {
                in: [
                  AttendanceStatus.SUPERVISOR_APPROVED,
                  AttendanceStatus.APPROVED_WITH_WARNING,
                ],
              },
            }
          : {
              status: {
                notIn: [
                  AttendanceStatus.VOIDED,
                  AttendanceStatus.SUPERVISOR_REJECTED,
                ],
              },
            }),
    };

    const records = (await this.prisma.attendance.findMany({
      where,
      orderBy: [{ clockInServerAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        officerId: true,
        siteId: true,
        shiftId: true,
        status: true,
        clockInServerAt: true,
        clockOutServerAt: true,
        totalBreakMinutes: true,
        grossMinutes: true,
        payableMinutes: true,
        overtimeMinutes: true,
        lateMinutes: true,
        earlyDepartureMinutes: true,
        reviewedAt: true,
        reviewedByUserId: true,
        officer: {
          select: {
            officerNumber: true,
            user: {
              select: {
                employeeId: true,
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        },
        site: { select: { name: true, code: true } },
        shift: {
          select: { title: true, scheduledStartAt: true, scheduledEndAt: true },
        },
        assignment: { select: { supervisorId: true } },
      },
    })) as AttendanceReportRecord[];

    const detailRows = records.map((record) =>
      this.toDetailRow(record, hoursBasis, timeZone),
    );

    const summary = this.buildSummary(detailRows);
    const { page, limit, skip } = normalisePagination(query.page, query.limit);
    const formula =
      hoursBasis === 'payable'
        ? 'workedMinutes = (clockOut - clockIn) - totalBreakMinutes; hours = minutes / 60'
        : 'clockOut - clockIn (gross)';

    const base = {
      range: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        timezone: timeZone,
      },
      organisation: organisation
        ? {
            id: organisation.id,
            name: organisation.name,
            timezone: timeZone,
          }
        : null,
      filters: {
        officerIds,
        siteId: query.siteId ?? null,
        shiftId: query.shiftId ?? null,
        status: query.status ?? null,
        supervisorId: query.supervisorId ?? null,
        approvedOnly,
        hoursBasis,
      },
      reportType,
      hoursBasis,
      formula,
      summary,
    };

    if (reportType === 'detail') {
      const pageRows = detailRows.slice(skip, skip + limit);
      return {
        ...base,
        rows: pageRows,
        meta: buildPaginationMeta(page, limit, detailRows.length),
      };
    }

    if (reportType === 'by-site') {
      return {
        ...base,
        rows: this.buildBySiteRows(detailRows),
      };
    }

    if (reportType === 'officer-site') {
      return {
        ...base,
        rows: this.buildOfficerSiteRows(detailRows),
      };
    }

    if (reportType === 'officer-all-sites') {
      const rows = this.buildOfficerAllSitesRows(detailRows);
      const uniqueDays = new Set(
        detailRows.map((row) => row.dayKey).filter(Boolean),
      );
      return {
        ...base,
        rows,
        grandTotal: {
          totalHours: this.attendanceCalculation.roundHoursFromSeconds(
            rows.reduce((sum, row) => sum + row.totalSeconds, 0),
          ),
          totalDays: uniqueDays.size,
        },
      };
    }

    if (reportType === 'all-officers') {
      return {
        ...base,
        rows: this.buildAllOfficersRows(detailRows),
      };
    }

    if (reportType === 'payroll-summary') {
      const payroll = await this.buildPayrollSummary({
        organisationId,
        timeZone,
        fromDate,
        toDate,
        detailRows,
        query,
        officerScope,
      });
      return {
        ...base,
        rows: this.buildOfficerSiteBreakdown(detailRows),
        payroll,
      };
    }

    return {
      ...base,
      rows: this.buildOfficerSiteBreakdown(detailRows),
    };
  }

  private emptyAttendanceHoursResponse(
    query: AttendanceHoursQueryDto,
    reportType: AttendanceReportType,
    hoursBasis: AttendanceHoursBasis,
  ) {
    const { page, limit } = normalisePagination(query.page, query.limit);
    return {
      range: { from: query.from, to: query.to },
      filters: {
        officerIds: this.resolveOfficerIds(query),
        siteId: query.siteId ?? null,
        shiftId: query.shiftId ?? null,
        status: query.status ?? null,
        supervisorId: query.supervisorId ?? null,
        approvedOnly:
          query.approvedOnly === 'true' || query.approvedOnly === '1',
        hoursBasis,
      },
      reportType,
      hoursBasis,
      formula:
        hoursBasis === 'payable'
          ? 'workedMinutes = (clockOut - clockIn) - totalBreakMinutes; hours = minutes / 60'
          : 'clockOut - clockIn (gross)',
      summary: {
        totalOfficers: 0,
        totalAttendanceRecords: 0,
        totalHoursWorked: 0,
        totalGrossHours: 0,
        totalPayableHours: 0,
        totalOvertimeHours: 0,
        totalBreakHours: 0,
        averageHoursPerOfficer: 0,
        averageHoursPerDay: 0,
        totalDaysWorked: 0,
      },
      rows: [],
      ...(reportType === 'detail'
        ? { meta: buildPaginationMeta(page, limit, 0) }
        : {}),
      ...(reportType === 'officer-all-sites'
        ? { grandTotal: { totalHours: 0, totalDays: 0 } }
        : {}),
    };
  }

  private resolveReportType(
    value: AttendanceReportType | undefined,
  ): AttendanceReportType {
    if (
      value &&
      (ATTENDANCE_REPORT_TYPES as readonly string[]).includes(value)
    ) {
      return value;
    }
    return 'detail';
  }

  private resolveHoursBasis(
    value: AttendanceHoursBasis | undefined,
  ): AttendanceHoursBasis {
    return value === 'gross' ? 'gross' : 'payable';
  }

  private resolveOfficerIds(query: AttendanceHoursQueryDto): string[] {
    const ids = [
      ...(query.officerIds ?? []),
      ...(query.officerId ? [query.officerId] : []),
    ];
    return [...new Set(ids.filter(Boolean))];
  }

  private parseRangeStart(value: string, timeZone: string): Date {
    if (parseDateKey(value)) {
      return startOfZonedDay(value, timeZone);
    }
    return new Date(value);
  }

  private parseRangeEnd(value: string, timeZone: string): Date {
    if (parseDateKey(value)) {
      return endOfZonedDay(value, timeZone);
    }
    return new Date(value);
  }

  /**
   * Gross seconds = actual clockOut - clockIn.
   * Payable seconds = gross - actual break minutes.
   * Stored minute fields are not used for payroll totals (they lose seconds).
   */
  private computeWorkedSeconds(record: {
    clockInServerAt: Date | null;
    clockOutServerAt: Date | null;
    totalBreakMinutes: number;
    grossMinutes: number | null;
    payableMinutes: number | null;
    overtimeMinutes: number | null;
    lateMinutes: number | null;
    earlyDepartureMinutes: number | null;
  }): {
    attendanceSeconds: number;
    breakSeconds: number;
    grossSeconds: number;
    payableSeconds: number;
    overtimeSeconds: number;
    lateMinutes: number;
    earlyDepartureMinutes: number;
    valid: boolean;
  } {
    const clockIn = record.clockInServerAt;
    const clockOut = record.clockOutServerAt;
    const valid =
      Boolean(clockIn && clockOut) &&
      (clockOut?.getTime() ?? 0) >= (clockIn?.getTime() ?? 0);
    const attendanceSeconds = valid
      ? Math.max(0, (clockOut!.getTime() - clockIn!.getTime()) / 1000)
      : 0;
    const breakSeconds = Math.max(0, (record.totalBreakMinutes ?? 0) * 60);
    const grossSeconds = attendanceSeconds;
    const payableSeconds = Math.max(0, grossSeconds - breakSeconds);
    const overtimeSeconds =
      record.overtimeMinutes != null && Number.isFinite(record.overtimeMinutes)
        ? Math.max(0, record.overtimeMinutes * 60)
        : 0;
    return {
      attendanceSeconds,
      breakSeconds,
      grossSeconds,
      payableSeconds,
      overtimeSeconds,
      lateMinutes: Math.max(0, record.lateMinutes ?? 0),
      earlyDepartureMinutes: Math.max(0, record.earlyDepartureMinutes ?? 0),
      valid,
    };
  }

  private officerDisplayName(record: AttendanceReportRecord): string {
    const user = record.officer?.user;
    const name =
      user?.displayName?.trim() ||
      `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
    return name || 'Unknown officer';
  }

  private toDetailRow(
    record: AttendanceReportRecord,
    hoursBasis: AttendanceHoursBasis,
    timeZone: string,
  ) {
    const calc = this.computeWorkedSeconds(record);
    const dayKey = record.clockInServerAt
      ? zonedDateKey(record.clockInServerAt, timeZone)
      : '';
    const workedSeconds =
      hoursBasis === 'gross' ? calc.grossSeconds : calc.payableSeconds;
    return {
      attendanceId: record.id,
      officerId: record.officerId,
      officerName: this.officerDisplayName(record),
      employeeId: record.officer?.user?.employeeId ?? null,
      officerNumber: record.officer?.officerNumber ?? null,
      siteId: record.siteId,
      siteName: record.site?.name ?? record.site?.code ?? 'Unknown site',
      shiftId: record.shiftId,
      shiftTitle: record.shift?.title ?? 'Unknown shift',
      shiftStartAt: record.shift?.scheduledStartAt?.toISOString() ?? null,
      shiftEndAt: record.shift?.scheduledEndAt?.toISOString() ?? null,
      supervisorId: record.assignment?.supervisorId ?? null,
      status: record.status,
      clockInAt: record.clockInServerAt?.toISOString() ?? null,
      clockOutAt: record.clockOutServerAt?.toISOString() ?? null,
      reviewedAt: record.reviewedAt?.toISOString() ?? null,
      reviewedByUserId: record.reviewedByUserId,
      dayKey,
      attendanceSeconds: calc.attendanceSeconds,
      breakSeconds: calc.breakSeconds,
      grossSeconds: calc.grossSeconds,
      payableSeconds: calc.payableSeconds,
      overtimeSeconds: calc.overtimeSeconds,
      lateMinutes: calc.lateMinutes,
      earlyDepartureMinutes: calc.earlyDepartureMinutes,
      workedSeconds,
      breakHours: this.attendanceCalculation.roundHoursFromSeconds(
        calc.breakSeconds,
      ),
      grossHours: this.attendanceCalculation.roundHoursFromSeconds(
        calc.grossSeconds,
      ),
      payableHours: this.attendanceCalculation.roundHoursFromSeconds(
        calc.payableSeconds,
      ),
      overtimeHours: this.attendanceCalculation.roundHoursFromSeconds(
        calc.overtimeSeconds,
      ),
      workedHours:
        this.attendanceCalculation.roundHoursFromSeconds(workedSeconds),
      valid: calc.valid,
    };
  }

  private buildSummary(
    rows: Array<{
      officerId: string;
      dayKey: string;
      breakSeconds: number;
      workedSeconds: number;
      grossSeconds: number;
      payableSeconds: number;
      overtimeSeconds: number;
    }>,
  ) {
    const officerIds = new Set(rows.map((row) => row.officerId));
    const dayKeys = new Set(rows.map((row) => row.dayKey).filter(Boolean));
    const totalWorkedSeconds = rows.reduce(
      (sum, row) => sum + row.workedSeconds,
      0,
    );
    const totalBreakSeconds = rows.reduce(
      (sum, row) => sum + row.breakSeconds,
      0,
    );
    const totalGrossSeconds = rows.reduce(
      (sum, row) => sum + row.grossSeconds,
      0,
    );
    const totalPayableSeconds = rows.reduce(
      (sum, row) => sum + row.payableSeconds,
      0,
    );
    const totalOvertimeSeconds = rows.reduce(
      (sum, row) => sum + row.overtimeSeconds,
      0,
    );
    const totalOfficers = officerIds.size;
    const totalDays = dayKeys.size;
    return {
      totalOfficers,
      totalAttendanceRecords: rows.length,
      totalHoursWorked:
        this.attendanceCalculation.roundHoursFromSeconds(totalWorkedSeconds),
      totalGrossHours:
        this.attendanceCalculation.roundHoursFromSeconds(totalGrossSeconds),
      totalPayableHours:
        this.attendanceCalculation.roundHoursFromSeconds(totalPayableSeconds),
      totalOvertimeHours:
        this.attendanceCalculation.roundHoursFromSeconds(totalOvertimeSeconds),
      totalBreakHours:
        this.attendanceCalculation.roundHoursFromSeconds(totalBreakSeconds),
      averageHoursPerOfficer: this.attendanceCalculation.calculateAverageHours(
        totalWorkedSeconds,
        totalOfficers,
      ),
      averageHoursPerDay: this.attendanceCalculation.calculateAverageHours(
        totalWorkedSeconds,
        totalDays,
      ),
      totalDaysWorked: totalDays,
    };
  }

  private buildBySiteRows(rows: ReturnType<ReportsService['toDetailRow']>[]) {
    const map = new Map<
      string,
      {
        siteId: string;
        siteName: string;
        officerIds: Set<string>;
        dayKeys: Set<string>;
        attendanceCount: number;
        totalSeconds: number;
        totalBreakSeconds: number;
      }
    >();

    for (const row of rows) {
      const existing = map.get(row.siteId);
      if (existing) {
        existing.officerIds.add(row.officerId);
        if (row.dayKey) existing.dayKeys.add(row.dayKey);
        existing.attendanceCount += 1;
        existing.totalSeconds += row.workedSeconds;
        existing.totalBreakSeconds += row.breakSeconds;
      } else {
        map.set(row.siteId, {
          siteId: row.siteId,
          siteName: row.siteName,
          officerIds: new Set([row.officerId]),
          dayKeys: new Set(row.dayKey ? [row.dayKey] : []),
          attendanceCount: 1,
          totalSeconds: row.workedSeconds,
          totalBreakSeconds: row.breakSeconds,
        });
      }
    }

    return [...map.values()]
      .map((item) => {
        const daysWorked = item.dayKeys.size;
        return {
          siteId: item.siteId,
          siteName: item.siteName,
          officersCount: item.officerIds.size,
          daysWorked,
          attendanceCount: item.attendanceCount,
          totalBreakHours: this.attendanceCalculation.roundHoursFromSeconds(
            item.totalBreakSeconds,
          ),
          totalHours: this.attendanceCalculation.roundHoursFromSeconds(
            item.totalSeconds,
          ),
          averageDailyHours: this.attendanceCalculation.calculateAverageHours(
            item.totalSeconds,
            daysWorked,
          ),
        };
      })
      .sort((a, b) => b.totalHours - a.totalHours);
  }

  private buildOfficerSiteRows(
    rows: ReturnType<ReportsService['toDetailRow']>[],
  ) {
    const map = new Map<
      string,
      {
        officerId: string;
        officerName: string;
        employeeId: string | null;
        siteId: string;
        siteName: string;
        dayKeys: Set<string>;
        attendanceCount: number;
        totalSeconds: number;
        totalBreakSeconds: number;
      }
    >();

    for (const row of rows) {
      const key = `${row.officerId}:${row.siteId}`;
      const existing = map.get(key);
      if (existing) {
        if (row.dayKey) existing.dayKeys.add(row.dayKey);
        existing.attendanceCount += 1;
        existing.totalSeconds += row.workedSeconds;
        existing.totalBreakSeconds += row.breakSeconds;
      } else {
        map.set(key, {
          officerId: row.officerId,
          officerName: row.officerName,
          employeeId: row.employeeId,
          siteId: row.siteId,
          siteName: row.siteName,
          dayKeys: new Set(row.dayKey ? [row.dayKey] : []),
          attendanceCount: 1,
          totalSeconds: row.workedSeconds,
          totalBreakSeconds: row.breakSeconds,
        });
      }
    }

    return [...map.values()]
      .map((item) => {
        const daysWorked = item.dayKeys.size;
        return {
          officerId: item.officerId,
          officerName: item.officerName,
          employeeId: item.employeeId,
          siteId: item.siteId,
          siteName: item.siteName,
          attendanceCount: item.attendanceCount,
          daysWorked,
          totalBreakHours: this.attendanceCalculation.roundHoursFromSeconds(
            item.totalBreakSeconds,
          ),
          totalHours: this.attendanceCalculation.roundHoursFromSeconds(
            item.totalSeconds,
          ),
          averageHoursPerDay: this.attendanceCalculation.calculateAverageHours(
            item.totalSeconds,
            daysWorked,
          ),
        };
      })
      .sort((a, b) => b.totalHours - a.totalHours);
  }

  private buildOfficerAllSitesRows(
    rows: ReturnType<ReportsService['toDetailRow']>[],
  ) {
    const map = new Map<
      string,
      {
        siteId: string;
        siteName: string;
        dayKeys: Set<string>;
        totalSeconds: number;
      }
    >();

    for (const row of rows) {
      const existing = map.get(row.siteId);
      if (existing) {
        if (row.dayKey) existing.dayKeys.add(row.dayKey);
        existing.totalSeconds += row.workedSeconds;
      } else {
        map.set(row.siteId, {
          siteId: row.siteId,
          siteName: row.siteName,
          dayKeys: new Set(row.dayKey ? [row.dayKey] : []),
          totalSeconds: row.workedSeconds,
        });
      }
    }

    return [...map.values()]
      .map((item) => ({
        siteId: item.siteId,
        siteName: item.siteName,
        daysWorked: item.dayKeys.size,
        totalSeconds: item.totalSeconds,
        totalHours: this.attendanceCalculation.roundHoursFromSeconds(
          item.totalSeconds,
        ),
      }))
      .sort((a, b) => b.totalHours - a.totalHours);
  }

  private buildAllOfficersRows(
    rows: ReturnType<ReportsService['toDetailRow']>[],
  ) {
    const map = new Map<
      string,
      {
        officerId: string;
        officerName: string;
        employeeId: string | null;
        officerNumber: string | null;
        sites: Set<string>;
        dayKeys: Set<string>;
        attendanceCount: number;
        totalSeconds: number;
        totalBreakSeconds: number;
        totalGrossSeconds: number;
        totalPayableSeconds: number;
        totalOvertimeSeconds: number;
      }
    >();

    for (const row of rows) {
      const existing = map.get(row.officerId);
      if (existing) {
        existing.sites.add(row.siteName);
        if (row.dayKey) existing.dayKeys.add(row.dayKey);
        existing.attendanceCount += 1;
        existing.totalSeconds += row.workedSeconds;
        existing.totalBreakSeconds += row.breakSeconds;
        existing.totalGrossSeconds += row.grossSeconds;
        existing.totalPayableSeconds += row.payableSeconds;
        existing.totalOvertimeSeconds += row.overtimeSeconds;
      } else {
        map.set(row.officerId, {
          officerId: row.officerId,
          officerName: row.officerName,
          employeeId: row.employeeId,
          officerNumber: row.officerNumber,
          sites: new Set([row.siteName]),
          dayKeys: new Set(row.dayKey ? [row.dayKey] : []),
          attendanceCount: 1,
          totalSeconds: row.workedSeconds,
          totalBreakSeconds: row.breakSeconds,
          totalGrossSeconds: row.grossSeconds,
          totalPayableSeconds: row.payableSeconds,
          totalOvertimeSeconds: row.overtimeSeconds,
        });
      }
    }

    return [...map.values()]
      .map((item) => ({
        officerId: item.officerId,
        officerName: item.officerName,
        employeeId: item.employeeId,
        officerNumber: item.officerNumber,
        sites: [...item.sites].sort(),
        daysWorked: item.dayKeys.size,
        attendanceCount: item.attendanceCount,
        totalBreakHours: this.attendanceCalculation.roundHoursFromSeconds(
          item.totalBreakSeconds,
        ),
        totalGrossHours: this.attendanceCalculation.roundHoursFromSeconds(
          item.totalGrossSeconds,
        ),
        totalPayableHours: this.attendanceCalculation.roundHoursFromSeconds(
          item.totalPayableSeconds,
        ),
        totalOvertimeHours: this.attendanceCalculation.roundHoursFromSeconds(
          item.totalOvertimeSeconds,
        ),
        totalHours: this.attendanceCalculation.roundHoursFromSeconds(
          item.totalSeconds,
        ),
      }))
      .sort((a, b) => b.totalHours - a.totalHours);
  }

  private buildOfficerSiteBreakdown(
    rows: ReturnType<ReportsService['toDetailRow']>[],
  ) {
    const officerMap = new Map<
      string,
      {
        officerId: string;
        officerName: string;
        employeeId: string | null;
        sites: Map<
          string,
          { siteId: string; siteName: string; totalSeconds: number }
        >;
      }
    >();

    for (const row of rows) {
      let officer = officerMap.get(row.officerId);
      if (!officer) {
        officer = {
          officerId: row.officerId,
          officerName: row.officerName,
          employeeId: row.employeeId,
          sites: new Map(),
        };
        officerMap.set(row.officerId, officer);
      }
      const site = officer.sites.get(row.siteId);
      if (site) {
        site.totalSeconds += row.workedSeconds;
      } else {
        officer.sites.set(row.siteId, {
          siteId: row.siteId,
          siteName: row.siteName,
          totalSeconds: row.workedSeconds,
        });
      }
    }

    return [...officerMap.values()]
      .map((officer) => {
        const sites = [...officer.sites.values()]
          .map((site) => ({
            siteId: site.siteId,
            siteName: site.siteName,
            totalHours: this.attendanceCalculation.roundHoursFromSeconds(
              site.totalSeconds,
            ),
          }))
          .sort((a, b) => b.totalHours - a.totalHours);
        const totalSeconds = [...officer.sites.values()].reduce(
          (sum, site) => sum + site.totalSeconds,
          0,
        );
        return {
          officerId: officer.officerId,
          officerName: officer.officerName,
          employeeId: officer.employeeId,
          sites,
          totalHours:
            this.attendanceCalculation.roundHoursFromSeconds(totalSeconds),
        };
      })
      .sort((a, b) => b.totalHours - a.totalHours);
  }

  async incidents(user: RequestUser) {
    const organisationId = requireOrganisationId(user);
    const officerScope = await this.supervisorOfficerScope(
      user,
      organisationId,
    );
    const incidentWhere: Prisma.IncidentWhereInput = {
      organisationId,
      deletedAt: null,
      ...(officerScope
        ? {
            OR: [
              { assignedSupervisorId: user.id },
              { reportedByOfficerId: { in: officerScope } },
              { reportedByUserId: user.id },
            ],
          }
        : {}),
    };
    const byStatus = await this.prisma.incident.groupBy({
      by: ['status'],
      where: incidentWhere,
      _count: { _all: true },
    });
    const bySeverity = await this.prisma.incident.groupBy({
      by: ['severity'],
      where: incidentWhere,
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
    const officerScope = await this.supervisorOfficerScope(
      user,
      organisationId,
    );
    const byStatus = await this.prisma.patrolAssignment.groupBy({
      by: ['status'],
      where: {
        organisationId,
        ...(officerScope ? { officerId: { in: officerScope } } : {}),
      },
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
    const officerScope = await this.supervisorOfficerScope(
      user,
      organisationId,
    );
    const byStatus = await this.prisma.emergency.groupBy({
      by: ['status'],
      where: {
        organisationId,
        ...(officerScope ? { officerId: { in: officerScope } } : {}),
      },
      _count: { _all: true },
    });
    return {
      byStatus: Object.fromEntries(
        byStatus.map((g) => [g.status, g._count._all]),
      ),
      export: this.exportStub('emergency'),
    };
  }

  /** Returns assigned officer IDs for supervisors; null means no extra scope (admins). */
  private async supervisorOfficerScope(
    user: RequestUser,
    organisationId: string,
  ): Promise<string[] | null> {
    if (user.role !== AppUserRole.SUPERVISOR) {
      return null;
    }
    const supervisorProfileId =
      await this.assignmentAccess.resolveSupervisorProfileId(
        user,
        organisationId,
      );
    if (!supervisorProfileId) {
      return [];
    }
    return this.assignmentAccess.listAssignedOfficerIds(
      organisationId,
      supervisorProfileId,
    );
  }

  private async buildPayrollSummary(input: {
    organisationId: string;
    timeZone: string;
    fromDate: Date;
    toDate: Date;
    detailRows: ReturnType<ReportsService['toDetailRow']>[];
    query: AttendanceHoursQueryDto;
    officerScope: string[] | null;
  }) {
    const assignments = await this.prisma.assignment.findMany({
      where: {
        organisationId: input.organisationId,
        isActive: true,
        ...(input.officerScope
          ? { officerId: { in: input.officerScope } }
          : {}),
        ...(input.query.officerId || input.query.officerIds?.length
          ? {
              officerId: {
                in: [
                  ...(input.query.officerId ? [input.query.officerId] : []),
                  ...(input.query.officerIds ?? []),
                ],
              },
            }
          : {}),
        ...(input.query.shiftId ? { shiftId: input.query.shiftId } : {}),
        ...(input.query.supervisorId
          ? { supervisorId: input.query.supervisorId }
          : {}),
        shift: {
          deletedAt: null,
          ...(input.query.siteId ? { siteId: input.query.siteId } : {}),
        },
      },
      select: {
        id: true,
        officerId: true,
        shift: {
          select: {
            scheduledStartAt: true,
            scheduledEndAt: true,
            recurrenceType: true,
            recurrenceEndAt: true,
            recurrenceDaysOfWeek: true,
            timezone: true,
            organisation: { select: { timezone: true } },
          },
        },
      },
    });

    let scheduledShifts = 0;
    for (const assignment of assignments) {
      scheduledShifts += expandOccurrences(
        {
          recurrenceType: assignment.shift.recurrenceType,
          scheduledStartAt: assignment.shift.scheduledStartAt,
          scheduledEndAt: assignment.shift.scheduledEndAt,
          recurrenceEndAt: assignment.shift.recurrenceEndAt,
          recurrenceDaysOfWeek: assignment.shift.recurrenceDaysOfWeek,
          timezone: assignment.shift.timezone,
          organisationTimezone: assignment.shift.organisation?.timezone,
        },
        input.fromDate,
        input.toDate,
        366,
      ).length;
    }

    const completedShifts = input.detailRows.filter((row) => row.valid).length;
    const missedShifts = Math.max(0, scheduledShifts - completedShifts);
    const totalClockedSeconds = input.detailRows.reduce(
      (sum, row) => sum + row.grossSeconds,
      0,
    );
    const totalBreakSeconds = input.detailRows.reduce(
      (sum, row) => sum + row.breakSeconds,
      0,
    );
    const totalWorkedSeconds = input.detailRows.reduce(
      (sum, row) => sum + row.workedSeconds,
      0,
    );
    const overtimeSeconds = input.detailRows.reduce(
      (sum, row) => sum + row.overtimeSeconds,
      0,
    );
    const dayKeys = new Set(
      input.detailRows.map((row) => row.dayKey).filter(Boolean),
    );

    return {
      totalScheduledShifts: scheduledShifts,
      completedShifts,
      missedShifts,
      totalClockedHours:
        this.attendanceCalculation.roundHoursFromSeconds(totalClockedSeconds),
      totalBreakHours:
        this.attendanceCalculation.roundHoursFromSeconds(totalBreakSeconds),
      totalWorkedHours:
        this.attendanceCalculation.roundHoursFromSeconds(totalWorkedSeconds),
      averageHoursPerDay: this.attendanceCalculation.calculateAverageHours(
        totalWorkedSeconds,
        dayKeys.size,
      ),
      overtimeHours:
        this.attendanceCalculation.roundHoursFromSeconds(overtimeSeconds),
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
