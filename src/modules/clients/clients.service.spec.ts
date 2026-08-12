import { HttpStatus } from '@nestjs/common';
import { ClientStatus } from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import type { RequestUser } from '../../common/types/request-user.type';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  const organisationId = 'org-1';
  const actor: RequestUser = {
    id: 'user-1',
    email: 'admin@example.com',
    role: UserRole.ADMINISTRATOR,
    accountStatus: AccountStatus.ACTIVE,
    organisationId,
    employeeId: 'ADM-001',
    sessionId: 'session-1',
    deviceId: null,
    permissions: ['client:archive'],
  };

  const prisma = {
    client: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    securitySite: {
      count: jest.fn(),
    },
  };

  const auditService = {
    record: jest.fn(),
  };

  const assignmentAccess = {
    resolveSupervisorOperationalScope: jest.fn().mockResolvedValue(null),
    emptySafeInFilter: (ids: string[]) => ({
      in: ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'],
    }),
  };

  const service = new ClientsService(
    prisma as never,
    auditService as never,
    assignmentAccess as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks archive when client has active sites', async () => {
    prisma.client.findFirst.mockResolvedValue({
      id: 'client-1',
      organisationId,
      status: ClientStatus.ACTIVE,
    });
    prisma.securitySite.count.mockResolvedValue(2);

    await expect(service.archive(actor, 'client-1', {})).rejects.toBeInstanceOf(
      AppException,
    );

    try {
      await service.archive(actor, 'client-1', {});
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      const appError = error as AppException;
      expect(appError.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(appError.getResponse()).toMatchObject({
        code: ErrorCode.CLIENT_HAS_ACTIVE_SITES,
      });
    }

    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it('allows archive when no active sites exist', async () => {
    prisma.client.findFirst.mockResolvedValue({
      id: 'client-1',
      organisationId,
      status: ClientStatus.ACTIVE,
    });
    prisma.securitySite.count.mockResolvedValue(0);
    prisma.client.update.mockResolvedValue({});

    await service.archive(actor, 'client-1', {});

    expect(prisma.client.update).toHaveBeenCalled();
    const updateCalls = prisma.client.update.mock.calls as unknown as Array<
      [
        {
          where: { id: string };
          data: { status: ClientStatus; deletedAt: Date };
        },
      ]
    >;
    const updateArg = updateCalls[0][0];
    expect(updateArg.where.id).toBe('client-1');
    expect(updateArg.data.status).toBe(ClientStatus.ARCHIVED);
    expect(updateArg.data.deletedAt).toBeInstanceOf(Date);
    expect(auditService.record).toHaveBeenCalled();
  });

  it('blocks status ARCHIVED when active sites exist', async () => {
    prisma.client.findFirst.mockResolvedValue({
      id: 'client-1',
      organisationId,
      status: ClientStatus.ACTIVE,
    });
    prisma.securitySite.count.mockResolvedValue(1);

    await expect(
      service.updateStatus(
        actor,
        'client-1',
        { status: ClientStatus.ARCHIVED },
        {},
      ),
    ).rejects.toBeInstanceOf(AppException);
  });
});
