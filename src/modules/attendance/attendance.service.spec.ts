import { randomUUID } from 'crypto';
import {
  AssignmentStatus,
  AttendanceStatus,
  DeviceStatus,
  GeofencePolicy,
  RecurrenceType,
  ShiftStatus,
} from '../../../generated/prisma/client';
import { ErrorCode } from '../../common/constants/error-codes';
import { UserRole } from '../../common/enums/user-role.enum';
import { AppException } from '../../common/exceptions/app.exception';
import type { RequestUser } from '../../common/types/request-user.type';
import { AttendanceCalculationService } from './attendance-calculation.service';
import { AttendanceService } from './attendance.service';
import { GeofenceService } from './geofence.service';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const OFFICER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_OFFICER_ID = '33333333-3333-4333-8333-333333333333';
const ASSIGNMENT_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_ASSIGNMENT_ID = '55555555-5555-4555-8555-555555555555';
const SHIFT_ID = '66666666-6666-4666-8666-666666666666';
const SITE_ID = '77777777-7777-4777-8777-777777777777';
const DEVICE_ID = '88888888-8888-4888-8888-888888888888';
const ATTENDANCE_ID = '99999999-9999-4999-8999-999999999999';

const US_SITE = { latitude: 40.7128, longitude: -74.006 };
const TESTER_GPS = { latitude: 8.4657, longitude: -13.2317, accuracyMeters: 8 };

function officerUser(): RequestUser {
  return {
    id: 'user-officer-1',
    email: 'officer@example.com',
    role: UserRole.SECURITY_OFFICER,
    accountStatus: 'ACTIVE',
    organisationId: ORG_ID,
    employeeId: 'OFF-001',
    sessionId: 'session-1',
    deviceId: DEVICE_ID,
    permissions: ['attendance:clock-in', 'attendance:clock-out'],
  };
}

function dailyShift() {
  return {
    id: SHIFT_ID,
    title: 'Afternoon',
    status: ShiftStatus.SCHEDULED,
    scheduledStartAt: new Date('2026-08-01T18:00:00.000Z'),
    scheduledEndAt: new Date('2026-08-01T21:00:00.000Z'),
    unpaidBreakMinutes: 0,
    gracePeriodMinutes: 15,
    overtimeThresholdMinutes: null,
    recurrenceType: RecurrenceType.DAILY,
    recurrenceEndAt: new Date('2026-12-31T21:00:00.000Z'),
    recurrenceDaysOfWeek: [],
    timezone: 'America/New_York',
    organisation: { timezone: 'America/New_York' },
    site: {
      id: SITE_ID,
      name: 'ABC Bank',
      code: 'ABC',
      address: 'New York',
      latitude: US_SITE.latitude,
      longitude: US_SITE.longitude,
      clockInRadiusMeters: 100,
      clockOutRadiusMeters: 100,
      checkpointDefaultRadiusMeters: 50,
      minimumGpsAccuracyMeters: 50,
      clockInOutsideGeofencePolicy: GeofencePolicy.BLOCK,
      clockOutOutsideGeofencePolicy: GeofencePolicy.BLOCK,
      requiresClockInSelfie: false,
      requiresClockOutSelfie: false,
      requiresPatrol: false,
      requiresFinalShiftNote: false,
      instructions: null,
      status: 'ACTIVE',
    },
  };
}

function assignmentRow(officerId = OFFICER_ID) {
  return {
    id: ASSIGNMENT_ID,
    organisationId: ORG_ID,
    officerId,
    isActive: true,
    status: AssignmentStatus.CONFIRMED,
    shift: dailyShift(),
  };
}

function decimal(value: number) {
  return { toString: () => String(value), toNumber: () => value };
}

describe('AttendanceService clock-in/out', () => {
  let geofenceEnabled = false;
  let prisma: {
    assignment: { findFirst: jest.Mock };
    attendance: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    attendanceEvent: { create: jest.Mock };
    assignmentUpdate: jest.Mock;
    device: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let createdPayload: Record<string, unknown> | null;
  let service: AttendanceService;
  let begin: jest.Mock;

  const ctx = { ipAddress: '127.0.0.1', userAgent: 'jest' };

  function buildService() {
    createdPayload = null;
    prisma = {
      assignment: { findFirst: jest.fn() },
      attendance: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      attendanceEvent: { create: jest.fn().mockResolvedValue({}) },
      assignmentUpdate: jest.fn().mockResolvedValue({}),
      device: {
        findFirst: jest.fn().mockResolvedValue({ status: DeviceStatus.ACTIVE }),
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation(
      (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          attendance: {
            create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
              createdPayload = data;
              return {
                id: ATTENDANCE_ID,
                ...data,
                clockInLatitude: decimal(Number(TESTER_GPS.latitude)),
                clockInLongitude: decimal(Number(TESTER_GPS.longitude)),
                clockInAccuracyMeters: decimal(TESTER_GPS.accuracyMeters),
                clockInDistanceMeters: decimal(
                  Number(data.clockInDistanceMeters),
                ),
                assignment: {
                  id: ASSIGNMENT_ID,
                  status: AssignmentStatus.IN_PROGRESS,
                  officerId: OFFICER_ID,
                  supervisorId: null,
                },
                officer: {
                  id: OFFICER_ID,
                  officerNumber: 'OFF-1',
                  employmentStatus: 'ACTIVE',
                },
                shift: dailyShift(),
                site: dailyShift().site,
                breaks: [],
                events: [],
                createdAt: new Date(),
                updatedAt: new Date(),
              };
            }),
            update: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
              id: ATTENDANCE_ID,
              organisationId: ORG_ID,
              assignmentId: ASSIGNMENT_ID,
              officerId: OFFICER_ID,
              shiftId: SHIFT_ID,
              siteId: SITE_ID,
              occurrenceDate: new Date('2026-08-17T00:00:00.000Z'),
              status: data.status,
              clockInServerAt: new Date('2026-08-17T18:05:00.000Z'),
              clockInDeviceAt: new Date('2026-08-17T18:05:00.000Z'),
              clockInLatitude: decimal(TESTER_GPS.latitude),
              clockInLongitude: decimal(TESTER_GPS.longitude),
              clockInAccuracyMeters: decimal(TESTER_GPS.accuracyMeters),
              clockOutLatitude: decimal(TESTER_GPS.latitude),
              clockOutLongitude: decimal(TESTER_GPS.longitude),
              clockOutAccuracyMeters: decimal(TESTER_GPS.accuracyMeters),
              clockInOutsideGeofence: true,
              clockOutOutsideGeofence: true,
              geofenceEnforcementDisabled: true,
              assignment: {
                id: ASSIGNMENT_ID,
                status: AssignmentStatus.CONFIRMED,
                officerId: OFFICER_ID,
                supervisorId: null,
              },
              officer: {
                id: OFFICER_ID,
                officerNumber: 'OFF-1',
                employmentStatus: 'ACTIVE',
              },
              shift: dailyShift(),
              site: dailyShift().site,
              breaks: [],
              events: [],
              ...data,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
          },
          attendanceEvent: { create: jest.fn().mockResolvedValue({}) },
          assignment: { update: prisma.assignmentUpdate },
          assignmentEvent: { create: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      },
    );

    begin = jest.fn().mockResolvedValue({ found: false });
    service = new AttendanceService(
      prisma as never,
      {
        get: (key: string): boolean | number | undefined => {
          if (key === 'attendance.geofenceEnabled') return geofenceEnabled;
          if (key === 'attendance.clockInEarlyMinutes') return 0;
          if (key === 'attendance.deviceTimeToleranceMinutes') return 10;
          if (key === 'attendance.idempotencyTtlSeconds') return 86_400;
          return undefined;
        },
      } as never,
      new GeofenceService(),
      new AttendanceCalculationService(),
      { record: jest.fn().mockResolvedValue(undefined) } as never,
      {
        resolveOfficerProfileId: jest.fn().mockResolvedValue(OFFICER_ID),
      } as never,
      {
        begin,
        complete: jest.fn().mockResolvedValue(undefined),
        fail: jest.fn().mockResolvedValue(undefined),
      } as never,
      {} as never,
      {} as never,
    );
  }

  beforeEach(() => {
    geofenceEnabled = false;
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-17T18:05:00.000Z'));
    buildService();
    prisma.assignment.findFirst.mockResolvedValue(assignmentRow());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function clockInDto(overrides: Record<string, unknown> = {}) {
    return {
      assignmentId: ASSIGNMENT_ID,
      deviceTimestamp: new Date().toISOString(),
      ...TESTER_GPS,
      idempotencyKey: `clock-in-${randomUUID()}`,
      ...overrides,
    };
  }

  async function expectCode(action: Promise<unknown>, code: ErrorCode) {
    try {
      await action;
      throw new Error(`Expected ${code}`);
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getResponse()).toMatchObject({ code });
    }
  }

  it('creates attendance with officer, site, assignment, shift, GPS when geofence is off', async () => {
    const result = await service.clockIn(officerUser(), clockInDto(), ctx);
    expect(result.officerId).toBe(OFFICER_ID);
    expect(result.siteId).toBe(SITE_ID);
    expect(result.assignmentId).toBe(ASSIGNMENT_ID);
    expect(result.shiftId).toBe(SHIFT_ID);
    expect(result.clockInLatitude).toBe(TESTER_GPS.latitude);
    expect(result.clockInLongitude).toBe(TESTER_GPS.longitude);
    expect(result.clockInAccuracyMeters).toBe(TESTER_GPS.accuracyMeters);
    expect(result.clockInServerAt).toBeTruthy();
    expect(createdPayload?.clockInLatitude).toBeDefined();
    expect(createdPayload?.clockInOutsideGeofence).toBe(true);
    expect(createdPayload?.geofenceEnforcementDisabled).toBe(true);
    expect(Number(createdPayload?.clockInDistanceMeters)).toBeGreaterThan(100);
  });

  it('rejects outside radius when geofence is enabled', async () => {
    geofenceEnabled = true;
    buildService();
    prisma.assignment.findFirst.mockResolvedValue(assignmentRow());
    await expectCode(
      service.clockIn(officerUser(), clockInDto(), ctx),
      ErrorCode.ATTENDANCE_OUTSIDE_GEOFENCE,
    );
  });

  it('rejects clock-in before the scheduled start time', async () => {
    jest.setSystemTime(new Date('2026-08-17T12:00:00.000Z'));
    await expectCode(
      service.clockIn(
        officerUser(),
        clockInDto({ deviceTimestamp: new Date().toISOString() }),
        ctx,
      ),
      ErrorCode.ATTENDANCE_CLOCK_IN_TOO_EARLY,
    );
  });

  it('rejects clock-in one minute before scheduled start', async () => {
    // Occurrence starts 18:00 UTC for this fixture day.
    jest.setSystemTime(new Date('2026-08-17T17:59:00.000Z'));
    await expectCode(
      service.clockIn(
        officerUser(),
        clockInDto({ deviceTimestamp: new Date().toISOString() }),
        ctx,
      ),
      ErrorCode.ATTENDANCE_CLOCK_IN_TOO_EARLY,
    );
  });

  it('rejects a different officer using this assignment', async () => {
    prisma.assignment.findFirst.mockResolvedValue(
      assignmentRow(OTHER_OFFICER_ID),
    );
    await expectCode(
      service.clockIn(officerUser(), clockInDto(), ctx),
      ErrorCode.ASSIGNMENT_NOT_FOUND,
    );
  });

  it('rejects an assignment that does not belong to the officer organisation', async () => {
    prisma.assignment.findFirst.mockResolvedValue(null);
    await expectCode(
      service.clockIn(
        officerUser(),
        clockInDto({ assignmentId: OTHER_ASSIGNMENT_ID }),
        ctx,
      ),
      ErrorCode.ASSIGNMENT_NOT_FOUND,
    );
  });

  it('rejects a second clock-in for the same occurrence', async () => {
    prisma.attendance.findFirst.mockResolvedValue({ id: ATTENDANCE_ID });
    await expectCode(
      service.clockIn(officerUser(), clockInDto(), ctx),
      ErrorCode.ATTENDANCE_ALREADY_EXISTS,
    );
  });

  it('replays a completed idempotent clock-in', async () => {
    const cached = { id: ATTENDANCE_ID, status: AttendanceStatus.CLOCKED_IN };
    begin.mockResolvedValue({
      replay: true,
      record: { responseBody: cached },
    });
    const result = await service.clockIn(officerUser(), clockInDto(), ctx);
    expect(result).toEqual(cached);
    expect(prisma.assignment.findFirst).not.toHaveBeenCalled();
  });

  it('clocks out the active attendance record', async () => {
    prisma.attendance.findFirst.mockResolvedValue({
      id: ATTENDANCE_ID,
      organisationId: ORG_ID,
      officerId: OFFICER_ID,
      assignmentId: ASSIGNMENT_ID,
      status: AttendanceStatus.CLOCKED_IN,
      clockInServerAt: new Date('2026-08-17T18:05:00.000Z'),
      occurrenceDate: new Date('2026-08-17T00:00:00.000Z'),
      breaks: [],
      assignment: {
        id: ASSIGNMENT_ID,
        status: AssignmentStatus.IN_PROGRESS,
        officerId: OFFICER_ID,
      },
      shift: dailyShift(),
      site: dailyShift().site,
    });

    const result = await service.clockOut(
      officerUser(),
      {
        attendanceId: ATTENDANCE_ID,
        deviceTimestamp: new Date().toISOString(),
        ...TESTER_GPS,
        idempotencyKey: `clock-out-${randomUUID()}`,
      },
      ctx,
    );
    expect(result.status).toBe(AttendanceStatus.CLOCKED_OUT);
    expect(result.clockOutLatitude).toBe(TESTER_GPS.latitude);
    expect(result.clockOutAccuracyMeters).toBe(TESTER_GPS.accuracyMeters);
  });
});
