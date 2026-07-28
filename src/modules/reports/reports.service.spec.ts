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
      shift: { title: 'Day Shift' },
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
      shift: { title: 'Day Shift' },
    },
  ];

  const prisma = {
    attendance: {
      findMany: jest.fn(),
    },
  };

  const assignmentAccess = {
    resolveSupervisorProfileId: jest.fn(),
    listAssignedOfficerIds: jest.fn(),
  };

  const calculator = new AttendanceCalculationService();

  let service: ReportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.attendance.findMany.mockResolvedValue(records);
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

    const detailRows = detail.rows as Array<{ workedSeconds: number }>;
    const rawTotalSeconds = detailRows.reduce(
      (sum, row) => sum + row.workedSeconds,
      0,
    );
    expect(rawTotalSeconds).toBe(2280);
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

    expect(officerAllSites.grandTotal).toEqual({
      totalHours: detail.summary.totalHoursWorked,
      totalDays: detail.summary.totalDaysWorked,
    });
  });
});
