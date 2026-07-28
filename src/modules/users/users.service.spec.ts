import {
  AccountStatus,
  AuditAction,
  UserRole,
} from '../../../generated/prisma/client';
import { UsersService } from './users.service';
import { ErrorCode } from '../../common/constants/error-codes';
import type { RequestUser } from '../../common/types/request-user.type';
import type { CreateUserDto } from './dto/create-user.dto';

describe('UsersService', () => {
  const organisationId = '11111111-1111-1111-1111-111111111111';
  const targetUserId = '33333333-3333-3333-3333-333333333333';

  const actor: RequestUser = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'admin@example.com',
    role: UserRole.ADMINISTRATOR,
    accountStatus: AccountStatus.ACTIVE,
    organisationId,
    employeeId: 'ADM-001',
    sessionId: 'session-id',
    deviceId: null,
    permissions: ['user:create', 'user:disable', 'user:archive'],
  };

  const baseUser = {
    id: targetUserId,
    organisationId,
    employeeId: 'OFF-002',
    email: 'officer2@example.com',
    phone: '+23276000000',
    passwordHash: 'hashed',
    firstName: 'Mariama',
    middleName: null,
    lastName: 'Kamara',
    displayName: null,
    role: UserRole.SECURITY_OFFICER,
    status: AccountStatus.ACTIVE,
    avatarUrl: null,
    mustChangePassword: true,
    lastLoginAt: null,
    passwordChangedAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
  };

  const prisma = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    officerProfile: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    supervisorProfile: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshSession: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const assertPolicy = jest.fn();
  const hash = jest.fn();
  const passwordService = { assertPolicy, hash };

  const sessionService = {
    revokeAllForUser: jest.fn(),
  };

  const authAuditService = {
    record: jest.fn(),
  };

  const storage = {
    name: 'local',
    createUploadUrl: jest.fn(),
    completeUpload: jest.fn(),
    getPublicUrl: jest.fn((key: string) => `http://127.0.0.1:3000/${key}`),
    getSignedDownloadUrl: jest.fn(),
    deleteObject: jest.fn(),
  };

  const localStorage = {
    putObject: jest.fn(() => 'checksum'),
    writeObjectFromTicket: jest.fn(),
    getRoot: jest.fn(),
    resolveObjectPath: jest.fn(),
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: ((tx: typeof prisma) => unknown) | unknown[]) => {
        if (typeof callback === 'function') {
          return Promise.resolve(callback(prisma));
        }
        return Promise.all(callback);
      },
    );
    service = new UsersService(
      prisma as never,
      passwordService as never,
      sessionService as never,
      authAuditService as never,
      storage as never,
      localStorage as never,
    );
  });

  const createDto: CreateUserDto = {
    employeeId: 'off-002',
    email: 'Officer2@Example.com',
    phone: '+23276000000',
    firstName: 'Mariama',
    lastName: 'Kamara',
    role: UserRole.SECURITY_OFFICER,
    temporaryPassword: 'Strong!Temporary2026',
  };

  it('creates a user with hashed password and normalized email', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    hash.mockResolvedValue('hashed-password');
    prisma.user.create.mockResolvedValue({
      ...baseUser,
      email: 'officer2@example.com',
      employeeId: 'OFF-002',
    });
    prisma.officerProfile.findFirst.mockResolvedValue(null);
    prisma.officerProfile.create.mockResolvedValue({ id: 'profile-1' });

    const result = await service.create(actor, createDto, {});

    expect(assertPolicy).toHaveBeenCalledWith(createDto.temporaryPassword);
    expect(hash).toHaveBeenCalledWith(createDto.temporaryPassword);
    expect(prisma.officerProfile.create).toHaveBeenCalled();

    const createCalls = prisma.user.create.mock.calls as unknown as Array<
      [
        {
          data: {
            organisationId: string;
            email: string;
            employeeId: string;
            status: AccountStatus;
            mustChangePassword: boolean;
            passwordChangedAt: Date | null;
          };
        },
      ]
    >;
    const createArg = createCalls[0][0];
    expect(createArg.data.organisationId).toBe(organisationId);
    expect(createArg.data.email).toBe('officer2@example.com');
    expect(createArg.data.employeeId).toBe('OFF-002');
    expect(createArg.data.status).toBe(AccountStatus.ACTIVE);
    expect(createArg.data.mustChangePassword).toBe(true);
    expect(createArg.data.passwordChangedAt).toBeNull();

    const auditCalls = authAuditService.record.mock.calls as unknown as Array<
      [{ action: AuditAction; metadata?: Record<string, unknown> }]
    >;
    const auditArg = auditCalls[0][0];
    expect(auditArg.action).toBe(AuditAction.CREATE);
    expect(auditArg.metadata).not.toHaveProperty('temporaryPassword');
    expect(result).not.toHaveProperty('passwordHash');
    expect(result.email).toBe('officer2@example.com');
  });

  it('rejects SUPER_ADMIN role assignment', async () => {
    await expect(
      service.create(actor, { ...createDto, role: UserRole.SUPER_ADMIN }, {}),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.USER_ROLE_FORBIDDEN },
    });
  });

  it('rejects duplicate employee ID', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ id: 'existing' });

    await expect(service.create(actor, createDto, {})).rejects.toMatchObject({
      response: { code: ErrorCode.USER_EMPLOYEE_ID_CONFLICT },
    });
  });

  it('prevents disabling the last active administrator', async () => {
    const adminUser = {
      ...baseUser,
      id: '44444444-4444-4444-4444-444444444444',
      role: UserRole.ADMINISTRATOR,
      employeeId: 'ADM-002',
    };
    prisma.user.findFirst.mockResolvedValue(adminUser);
    prisma.user.count.mockResolvedValue(0);

    await expect(
      service.updateStatus(
        actor,
        adminUser.id,
        { status: AccountStatus.SUSPENDED },
        {},
      ),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.USER_LAST_ADMIN_REQUIRED },
    });
  });

  it('allows valid status transition and revokes sessions', async () => {
    prisma.user.findFirst.mockResolvedValue(baseUser);
    prisma.user.update.mockResolvedValue({
      ...baseUser,
      status: AccountStatus.SUSPENDED,
    });
    prisma.refreshSession.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.updateStatus(
      actor,
      targetUserId,
      { status: AccountStatus.SUSPENDED, reason: 'Policy breach' },
      {},
    );

    const revokeCalls = prisma.refreshSession.updateMany.mock
      .calls as unknown as Array<
      [
        {
          where: { userId: string; revokedAt: null };
          data: { revokedAt: Date };
        },
      ]
    >;
    const revokeArg = revokeCalls[0][0];
    expect(revokeArg.where).toEqual({
      userId: targetUserId,
      revokedAt: null,
    });
    expect(revokeArg.data.revokedAt).toBeInstanceOf(Date);
    expect(result.status).toBe(AccountStatus.SUSPENDED);
  });

  it('rejects invalid status transitions', async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...baseUser,
      status: AccountStatus.INVITED,
    });

    await expect(
      service.updateStatus(
        actor,
        targetUserId,
        { status: AccountStatus.DISABLED },
        {},
      ),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.BAD_REQUEST },
    });
  });

  it('archives a user, sets deletedAt and revokes sessions', async () => {
    prisma.user.findFirst.mockResolvedValue(baseUser);
    prisma.user.update.mockResolvedValue({
      ...baseUser,
      status: AccountStatus.ARCHIVED,
      deletedAt: new Date(),
    });
    prisma.refreshSession.updateMany.mockResolvedValue({ count: 1 });

    await service.archive(actor, targetUserId, {});

    const updateCalls = prisma.user.update.mock.calls as unknown as Array<
      [
        {
          where: { id: string };
          data: { status: AccountStatus; deletedAt: Date };
        },
      ]
    >;
    const updateArg = updateCalls[0][0];
    expect(updateArg.where.id).toBe(targetUserId);
    expect(updateArg.data.status).toBe(AccountStatus.ARCHIVED);
    expect(updateArg.data.deletedAt).toBeInstanceOf(Date);

    const auditCalls = authAuditService.record.mock.calls as unknown as Array<
      [{ action: AuditAction; metadata: { event: string } }]
    >;
    const auditArg = auditCalls[0][0];
    expect(auditArg.action).toBe(AuditAction.DELETE);
    expect(auditArg.metadata.event).toBe('archive');
  });

  it('prevents self archive', async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...baseUser,
      id: actor.id,
    });

    await expect(service.archive(actor, actor.id, {})).rejects.toMatchObject({
      response: { code: ErrorCode.USER_SELF_STATUS_CHANGE_FORBIDDEN },
    });
  });
});
