import { HttpStatus } from '@nestjs/common';
import {
  OfficerEmploymentStatus,
  Prisma,
  UserRole,
} from '../../../generated/prisma/client';
import { ErrorCode } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import { UserRole as AppUserRole } from '../../common/enums/user-role.enum';
import type { RequestUser } from '../../common/types/request-user.type';
import { OfficersService } from './officers.service';

describe('OfficersService', () => {
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
    permissions: ['officer:create'],
  };

  const assertPolicy = jest.fn();
  const hash = jest.fn().mockResolvedValue('hashed-password');
  const revokeAllForUser = jest.fn();
  const record = jest.fn().mockResolvedValue(undefined);

  let prisma: {
    $transaction: jest.Mock;
    user: { create: jest.Mock };
    officerProfile: { create: jest.Mock };
  };

  let service: OfficersService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      user: { create: jest.fn() },
      officerProfile: { create: jest.fn() },
    };

    service = new OfficersService(
      prisma as never,
      { assertPolicy, hash } as never,
      { revokeAllForUser } as never,
      { record } as never,
      {
        createUploadUrl: jest.fn(),
        completeUpload: jest.fn(),
        getPublicUrl: jest.fn(),
      } as never,
      { writeObjectFromTicket: jest.fn(), putObject: jest.fn() } as never,
    );
  });

  it('creates officer user and profile in one transaction', async () => {
    const createdProfile = {
      id: 'officer-profile-1',
      userId: 'user-1',
      organisationId,
      officerNumber: 'GT-OFF-003',
      employmentStatus: OfficerEmploymentStatus.ACTIVE,
      hireDate: null,
      gender: null,
      residentialAddress: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      emergencyContactRelationship: null,
      rankOrTitle: 'Security Officer',
      skills: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'user-1',
        organisationId,
        employeeId: 'OFF-003',
        email: 'officer3@example.com',
        phone: '+23277000000',
        firstName: 'Abu',
        middleName: null,
        lastName: 'Sesay',
        displayName: null,
        role: UserRole.SECURITY_OFFICER,
        status: 'ACTIVE',
        avatarUrl: null,
        mustChangePassword: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    prisma.$transaction.mockImplementation(
      (
        callback: (tx: {
          user: { create: jest.Mock };
          officerProfile: { create: jest.Mock };
        }) => unknown,
      ) =>
        Promise.resolve(
          callback({
            user: {
              create: jest.fn().mockResolvedValue(createdProfile.user),
            },
            officerProfile: {
              create: jest.fn().mockResolvedValue(createdProfile),
            },
          }),
        ),
    );

    const result = await service.create(
      actor,
      {
        user: {
          employeeId: 'off-003',
          email: 'Officer3@Example.com',
          phone: '+23277000000',
          firstName: 'Abu',
          lastName: 'Sesay',
          temporaryPassword: 'Strong!Temporary2026',
        },
        profile: {
          officerNumber: 'gt-off-003',
          rankOrTitle: 'Security Officer',
        },
      },
      {},
    );

    expect(assertPolicy).toHaveBeenCalled();
    expect(hash).toHaveBeenCalledWith('Strong!Temporary2026');
    expect(result.profile.officerNumber).toBe('GT-OFF-003');
    expect(result.user.email).toBe('officer3@example.com');
    expect(result.profile).not.toHaveProperty('nationalIdNumber');
    expect(result.profile).not.toHaveProperty('dateOfBirth');
    expect(record).toHaveBeenCalled();
  });

  it('maps duplicate officer number to OFFICER_NUMBER_CONFLICT', async () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint',
      {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: { target: ['organisationId', 'officerNumber'] },
      },
    );

    prisma.$transaction.mockRejectedValue(error);

    await expect(
      service.create(
        actor,
        {
          user: {
            employeeId: 'OFF-004',
            email: 'officer4@example.com',
            firstName: 'Test',
            lastName: 'Officer',
            temporaryPassword: 'Strong!Temporary2026',
          },
          profile: {
            officerNumber: 'GT-OFF-004',
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
            employeeId: 'OFF-004',
            email: 'officer4@example.com',
            firstName: 'Test',
            lastName: 'Officer',
            temporaryPassword: 'Strong!Temporary2026',
          },
          profile: {
            officerNumber: 'GT-OFF-004',
          },
        },
        {},
      );
    } catch (caught) {
      expect(caught).toBeInstanceOf(AppException);
      expect((caught as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
      expect((caught as AppException).getResponse()).toMatchObject({
        code: ErrorCode.OFFICER_NUMBER_CONFLICT,
      });
    }
  });

  it('maps duplicate employee ID to USER_EMPLOYEE_ID_CONFLICT', async () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint',
      {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: { target: ['organisationId', 'employeeId'] },
      },
    );

    prisma.$transaction.mockRejectedValue(error);

    await expect(
      service.create(
        actor,
        {
          user: {
            employeeId: 'OFF-004',
            email: 'officer4@example.com',
            firstName: 'Test',
            lastName: 'Officer',
            temporaryPassword: 'Strong!Temporary2026',
          },
          profile: {
            officerNumber: 'GT-OFF-004',
          },
        },
        {},
      ),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.USER_EMPLOYEE_ID_CONFLICT },
    });
  });
});
