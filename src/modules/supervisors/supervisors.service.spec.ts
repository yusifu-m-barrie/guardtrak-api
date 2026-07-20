import { HttpStatus } from '@nestjs/common';
import {
  OfficerEmploymentStatus,
  Prisma,
} from '../../../generated/prisma/client';
import { ErrorCode } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import { UserRole as AppUserRole } from '../../common/enums/user-role.enum';
import type { RequestUser } from '../../common/types/request-user.type';
import { SupervisorsService } from './supervisors.service';

describe('SupervisorsService', () => {
  const organisationId = 'org-1';
  const actor: RequestUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: AppUserRole.ADMINISTRATOR,
    accountStatus: 'ACTIVE',
    organisationId,
    employeeId: 'ADM-001',
    sessionId: 'session-1',
    deviceId: null,
    permissions: ['supervisor:assign-officer'],
  };

  const assertPolicy = jest.fn();
  const hash = jest.fn();
  const revokeAllForUser = jest.fn();
  const record = jest.fn().mockResolvedValue(undefined);

  let prisma: {
    $transaction: jest.Mock;
    supervisorProfile: { findFirst: jest.Mock };
  };

  let service: SupervisorsService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      supervisorProfile: {
        findFirst: jest.fn(),
      },
    };

    service = new SupervisorsService(
      prisma as never,
      { assertPolicy, hash } as never,
      { revokeAllForUser } as never,
      { record } as never,
    );
  });

  type AssignTx = {
    officerProfile: { findMany: jest.Mock };
    supervisorOfficer: { findFirst: jest.Mock; create: jest.Mock };
  };

  it('prevents duplicate active supervisor-officer assignments', async () => {
    prisma.supervisorProfile.findFirst.mockResolvedValue({
      id: 'supervisor-1',
      organisationId,
      userId: 'supervisor-user-1',
      supervisorNumber: 'GT-SUP-001',
      title: 'Shift Supervisor',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'supervisor-user-1',
        organisationId,
        employeeId: 'SUP-001',
        email: 'supervisor@example.com',
        phone: null,
        firstName: 'Super',
        middleName: null,
        lastName: 'Visor',
        displayName: null,
        role: 'SUPERVISOR',
        status: 'ACTIVE',
        avatarUrl: null,
        mustChangePassword: false,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    prisma.$transaction.mockImplementation(
      (callback: (tx: AssignTx) => unknown) =>
        Promise.resolve(
          callback({
            officerProfile: {
              findMany: jest.fn().mockResolvedValue([
                {
                  id: 'officer-1',
                  organisationId,
                  deletedAt: null,
                  employmentStatus: OfficerEmploymentStatus.ACTIVE,
                  user: { id: 'officer-user-1', status: 'ACTIVE' },
                },
              ]),
            },
            supervisorOfficer: {
              findFirst: jest.fn().mockResolvedValue({ id: 'relation-1' }),
              create: jest.fn(),
            },
          }),
        ),
    );

    await expect(
      service.assignOfficers(
        actor,
        'supervisor-1',
        {
          officerIds: ['officer-1'],
          activeFrom: '2026-07-18T00:00:00.000Z',
        },
        {},
      ),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.SUPERVISOR_OFFICER_RELATION_EXISTS },
    });
  });

  it('creates assignments when no active relation exists', async () => {
    prisma.supervisorProfile.findFirst.mockResolvedValue({
      id: 'supervisor-1',
      organisationId,
      userId: 'supervisor-user-1',
      supervisorNumber: 'GT-SUP-001',
      title: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'supervisor-user-1',
        organisationId,
        employeeId: 'SUP-001',
        email: 'supervisor@example.com',
        phone: null,
        firstName: 'Super',
        middleName: null,
        lastName: 'Visor',
        displayName: null,
        role: 'SUPERVISOR',
        status: 'ACTIVE',
        avatarUrl: null,
        mustChangePassword: false,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const relation = {
      id: 'relation-1',
      organisationId,
      supervisorId: 'supervisor-1',
      officerId: 'officer-1',
      activeFrom: new Date('2026-07-18T00:00:00.000Z'),
      activeUntil: null,
      createdAt: new Date(),
    };

    prisma.$transaction.mockImplementation(
      (callback: (tx: AssignTx) => unknown) =>
        Promise.resolve(
          callback({
            officerProfile: {
              findMany: jest.fn().mockResolvedValue([
                {
                  id: 'officer-1',
                  organisationId,
                  deletedAt: null,
                  employmentStatus: OfficerEmploymentStatus.ACTIVE,
                  user: { id: 'officer-user-1', status: 'ACTIVE' },
                },
              ]),
            },
            supervisorOfficer: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue(relation),
            },
          }),
        ),
    );

    const result = await service.assignOfficers(
      actor,
      'supervisor-1',
      {
        officerIds: ['officer-1'],
        activeFrom: '2026-07-18T00:00:00.000Z',
      },
      {},
    );

    expect(result.assigned).toHaveLength(1);
    expect(result.assigned[0].officerId).toBe('officer-1');
    expect(record).toHaveBeenCalled();
  });

  it('maps duplicate supervisor number on create to SUPERVISOR_NUMBER_CONFLICT', async () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint',
      {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: { target: ['organisationId', 'supervisorNumber'] },
      },
    );

    prisma.$transaction.mockRejectedValue(error);

    await expect(
      service.create(
        actor,
        {
          user: {
            employeeId: 'SUP-002',
            email: 'supervisor2@example.com',
            firstName: 'Aminata',
            lastName: 'Koroma',
            temporaryPassword: 'Strong!Temporary2026',
          },
          profile: {
            supervisorNumber: 'GT-SUP-002',
          },
        },
        {},
      ),
    ).rejects.toBeInstanceOf(AppException);

    try {
      await service.create(
        actor,
        {
          user: {
            employeeId: 'SUP-002',
            email: 'supervisor2@example.com',
            firstName: 'Aminata',
            lastName: 'Koroma',
            temporaryPassword: 'Strong!Temporary2026',
          },
          profile: {
            supervisorNumber: 'GT-SUP-002',
          },
        },
        {},
      );
    } catch (caught) {
      expect((caught as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
      expect((caught as AppException).getResponse()).toMatchObject({
        code: ErrorCode.SUPERVISOR_NUMBER_CONFLICT,
      });
    }
  });
});
