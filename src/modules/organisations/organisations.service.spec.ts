import {
  AccountStatus,
  AuditAction,
  UserRole,
} from '../../../generated/prisma/client';
import { OrganisationsService } from './organisations.service';
import { ErrorCode } from '../../common/constants/error-codes';
import type { RequestUser } from '../../common/types/request-user.type';

describe('OrganisationsService', () => {
  const organisationId = '11111111-1111-1111-1111-111111111111';
  const actor: RequestUser = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'admin@example.com',
    role: UserRole.ADMINISTRATOR,
    accountStatus: AccountStatus.ACTIVE,
    organisationId,
    employeeId: 'ADM-001',
    sessionId: 'session-id',
    deviceId: null,
    permissions: ['organisation:read:self'],
  };

  const organisation = {
    id: organisationId,
    code: 'GUARDTRAK',
    name: 'GuardTrak',
    legalName: null,
    registrationNumber: null,
    email: null,
    phone: null,
    address: null,
    countryCode: 'SL',
    timezone: 'Africa/Freetown',
    logoUrl: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
  };

  const prisma = {
    organisation: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const authAuditService = {
    record: jest.fn(),
  };

  let service: OrganisationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrganisationsService(
      prisma as never,
      authAuditService as never,
    );
  });

  it('returns tenant organisation summary', async () => {
    prisma.organisation.findFirst.mockResolvedValue(organisation);

    const result = await service.getSelf(actor);

    expect(prisma.organisation.findFirst).toHaveBeenCalledWith({
      where: { id: organisationId, deletedAt: null },
    });
    expect(result.id).toBe(organisationId);
    expect(result).not.toHaveProperty('deletedAt');
  });

  it('throws ORG_NOT_FOUND when organisation is missing', async () => {
    prisma.organisation.findFirst.mockResolvedValue(null);

    await expect(service.getSelf(actor)).rejects.toMatchObject({
      response: { code: ErrorCode.ORG_NOT_FOUND },
    });
  });

  it('requires organisation context', async () => {
    const platformActor = { ...actor, organisationId: null };

    await expect(service.getSelf(platformActor)).rejects.toMatchObject({
      response: { code: ErrorCode.AUTH_ORGANISATION_REQUIRED },
    });
  });

  it('updates organisation and audits the change', async () => {
    prisma.organisation.findFirst.mockResolvedValue(organisation);
    prisma.organisation.update.mockResolvedValue({
      ...organisation,
      name: 'Updated Name',
    });

    const result = await service.updateSelf(
      actor,
      { name: 'Updated Name' },
      { requestId: 'req-1' },
    );

    expect(prisma.organisation.update).toHaveBeenCalled();
    expect(authAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        entityType: 'Organisation',
      }),
    );
    expect(result.name).toBe('Updated Name');
  });
});
