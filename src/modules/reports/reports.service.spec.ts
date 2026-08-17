import { AttendanceStatus } from '../../../generated/prisma/client';
import { UserRole } from '../../common/enums/user-role.enum';
import type { RequestUser } from '../../common/types/request-user.type';
import { AttendanceCalculationService } from '../attendance/attendance-calculation.service';
import { ReportsService } from './reports.service';

describe('ReportsService attendance-hour consistency', () => {
  const organisationId = '11111111-1111-1111-1111-111111111111';
  const user: RequestUser = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'admin@example.com',
    role: UserRole.ADMINISTRATOR,
    accountStatus: 'ACTIVE' as never,
    organisationId,
    employeeId: 'ADM-001',
    sessionId: 'session-id',
    deviceId: null,
    permissions: ['report:read'],
  };

  const records = [
    {
      id: 'a1',
      officerId: 'officer-1',
      siteId: 'site-a',
      shiftId: 'shift-1',
      status: AttendanceStatus.CLOCKED_OUT,
      clockInServerAt: new Date('2026-07-18T11:22:00.000Z'),
      clockOutServerAt: new Date('2026-07-18T11:40:00.000Z'),
      totalBreakMinutes: 1,
      officer: {
        officerNumber: 'OFF-001',
        user: {
          employeeId: 'EMP-001',
          firstName: 'Alpha',
          lastName: 'Guard',
          displayName: null,
        },
      },
      site: { name: 'Site Alpha', code: 'ALP' },
      shift: {
        title: 'Day Shift',
        scheduledStartAt: new Date('2026-07-18T08:00:00.000Z'),
        scheduledEndAt: new Date('2026-07-18T16:00:00.000Z'),
      },
    },
    {
      id: 'a2',
      officerId: 'officer-1',
      siteId: 'site-b',
      shiftId: 'shift-1',
      status: AttendanceStatus.CLOCKED_OUT,
      clockInServerAt: new Date('2026-07-18T09:00:00.000Z'),
      clockOutServerAt: new Date('2026-07-18T09:20:00.000Z'),
      totalBreakMinutes: 0,
      officer: {
        officerNumber: 'OFF-001',
        user: {
          employeeId: 'EMP-001',
          firstName: 'Alpha',
          lastName: 'Guard',
          displayName: null,
        },
      },
      site: { name: 'Site Bravo', code: 'BRV' },
      shift: {
        title: 'Day Shift',
        scheduledStartAt: new Date('2026-07-18T08:00:00.000Z'),
        scheduledEndAt: new Date('2026-07-18T16:00:00.000Z'),
      },
    },
  ];

  const prisma = {
    attendance: {
      findMany: jest.fn(),
    },
    organisation: {
      findFirst: jest.fn(),
    },
    assignment: {
      findMany: jest.fn(),
    },
  };

  const assignmentAccess = {
    resolveSupervisorProfileId: jest.fn(),
    listAssignedOfficerIds: jest.fn(),
  };

  const calculator = new AttendanceCalculationService();

  let service: ReportsService;

  function attendanceQueryArg() {
    const [arg] = prisma.attendance.findMany.mock.calls[0] as [
      {
        where: {
          clockInServerAt: { gte: Date; lte: Date };
          officerId?: string;
          siteId?: string;
          shiftId?: string;
        };
      },
    ];
    return arg;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.attendance.findMany.mockResolvedValue(records);
    prisma.organisation.findFirst.mockResolvedValue({
      id: organisationId,
      name: 'Test Org',
      timezone: 'UTC',
    });
    prisma.assignment.findMany.mockResolvedValue([]);
    service = new ReportsService(
      prisma as never,
      assignmentAccess as never,
      calculator,
    );
  });

  it('uses raw seconds for totals and keeps report-type totals consistent', async () => {
    const queryBase = {
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-31T23:59:59.999Z',
      officerIds: ['officer-1'],
      siteId: undefined,
      shiftId: undefined,
      supervisorId: undefined,
      status: undefined,
      page: 1,
      limit: 20,
    };

    const detail = await service.attendanceHours(user, {
      ...queryBase,
      reportType: 'detail',
    });
    const bySite = await service.attendanceHours(user, {
      ...queryBase,
      reportType: 'by-site',
    });
    const officerSite = await service.attendanceHours(user, {
      ...queryBase,
      reportType: 'officer-site',
    });
    const officerAllSites = await service.attendanceHours(user, {
      ...queryBase,
      reportType: 'officer-all-sites',
    });
    const allOfficers = await service.attendanceHours(user, {
      ...queryBase,
      reportType: 'all-officers',
    });
    const breakdown = await service.attendanceHours(user, {
      ...queryBase,
      reportType: 'officer-site-breakdown',
    });
    const payroll = await service.attendanceHours(user, {
      ...queryBase,
      reportType: 'payroll-summary',
    });

    const detailRows = detail.rows as Array<{ workedSeconds: number }>;
    const rawTotalSeconds = detailRows.reduce(
      (sum, row) => sum + row.workedSeconds,
      0,
    );
    expect(rawTotalSeconds).toBe(2220);
    expect(detail.summary.totalHoursWorked).toBe(
      calculator.roundHoursFromSeconds(rawTotalSeconds),
    );

    expect(bySite.summary.totalHoursWorked).toBe(
      detail.summary.totalHoursWorked,
    );
    expect(officerSite.summary.totalHoursWorked).toBe(
      detail.summary.totalHoursWorked,
    );
    expect(officerAllSites.summary.totalHoursWorked).toBe(
      detail.summary.totalHoursWorked,
    );
    expect(allOfficers.summary.totalHoursWorked).toBe(
      detail.summary.totalHoursWorked,
    );
    expect(breakdown.summary.totalHoursWorked).toBe(
      detail.summary.totalHoursWorked,
    );

    expect(bySite.summary.totalBreakHours).toBe(detail.summary.totalBreakHours);
    expect(officerSite.summary.totalBreakHours).toBe(
      detail.summary.totalBreakHours,
    );
    expect(officerAllSites.summary.totalBreakHours).toBe(
      detail.summary.totalBreakHours,
    );
    expect(allOfficers.summary.totalBreakHours).toBe(
      detail.summary.totalBreakHours,
    );
    expect(breakdown.summary.totalBreakHours).toBe(
      detail.summary.totalBreakHours,
    );
    expect(payroll.summary.totalHoursWorked).toBe(
      detail.summary.totalHoursWorked,
    );
    expect(payroll.payroll).toEqual(
      expect.objectContaining({
        totalWorkedHours: detail.summary.totalHoursWorked,
      }),
    );

    expect(officerAllSites.grandTotal).toEqual({
      totalHours: detail.summary.totalHoursWorked,
      totalDays: detail.summary.totalDaysWorked,
    });
  });

  it('interprets date-only filters in America/New_York', async () => {
    prisma.organisation.findFirst.mockResolvedValue({
      id: organisationId,
      name: 'Test Org',
      timezone: 'America/New_York',
    });

    await service.attendanceHours(user, {
      from: '2026-08-01',
      to: '2026-08-31',
      reportType: 'detail',
      page: 1,
      limit: 20,
    });

    const where = attendanceQueryArg().where;
    expect(where.clockInServerAt.gte.toISOString()).toBe(
      '2026-08-01T04:00:00.000Z',
    );
    expect(where.clockInServerAt.lte.toISOString()).toBe(
      '2026-09-01T03:59:59.999Z',
    );
  });

  it('interprets date-only filters in UTC', async () => {
    await service.attendanceHours(user, {
      from: '2026-08-01',
      to: '2026-08-31',
      reportType: 'detail',
      page: 1,
      limit: 20,
    });

    const where = attendanceQueryArg().where;
    expect(where.clockInServerAt.gte.toISOString()).toBe(
      '2026-08-01T00:00:00.000Z',
    );
    expect(where.clockInServerAt.lte.toISOString()).toBe(
      '2026-08-31T23:59:59.999Z',
    );
  });

  it('passes officer, site, and shift filters to the attendance query', async () => {
    await service.attendanceHours(user, {
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-31T23:59:59.999Z',
      officerIds: ['officer-1'],
      siteId: 'site-a',
      shiftId: 'shift-1',
      reportType: 'officer-site',
      page: 1,
      limit: 20,
    });

    const where = attendanceQueryArg().where;
    expect(where.officerId).toBe('officer-1');
    expect(where.siteId).toBe('site-a');
    expect(where.shiftId).toBe('shift-1');
  });

  it('reports 8.00 payable hours for 08:00-17:00 minus a 60-minute break', async () => {
    prisma.attendance.findMany.mockResolvedValue([
      {
        ...records[0],
        clockInServerAt: new Date('2026-08-17T12:00:00.000Z'),
        clockOutServerAt: new Date('2026-08-17T21:00:00.000Z'),
        totalBreakMinutes: 60,
      },
    ]);

    const detail = await service.attendanceHours(user, {
      from: '2026-08-17',
      to: '2026-08-17',
      reportType: 'detail',
      hoursBasis: 'payable',
      page: 1,
      limit: 20,
    });
    const payroll = await service.attendanceHours(user, {
      from: '2026-08-17',
      to: '2026-08-17',
      reportType: 'payroll-summary',
      hoursBasis: 'payable',
      page: 1,
      limit: 20,
    });

    const row = detail.rows[0] as {
      workedSeconds: number;
      workedHours: number;
    };
    expect(row.workedSeconds).toBe(28800);
    expect(row.workedHours).toBe(8);
    expect(detail.summary.totalHoursWorked).toBe(8);
    expect(payroll.payroll).toEqual(
      expect.objectContaining({
        totalWorkedHours: 8,
        totalBreakHours: 1,
        totalClockedHours: 9,
      }),
    );
  });
});
