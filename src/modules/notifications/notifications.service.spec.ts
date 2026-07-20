import { NotificationsService } from './notifications.service';

describe('NotificationsService unread count helper', () => {
  it('returns unreadCount shape from prisma count', async () => {
    const prisma = {
      notification: {
        count: jest.fn().mockResolvedValue(3),
      },
    };
    const audit = { record: jest.fn() };
    const eventEmitter = { emit: jest.fn() };
    const service = new NotificationsService(
      prisma as never,
      audit as never,
      eventEmitter as never,
    );
    const result = await service.unreadCount({
      id: 'u1',
      email: 'a@b.c',
      role: 'SECURITY_OFFICER' as never,
      accountStatus: 'ACTIVE' as never,
      organisationId: 'org1',
      employeeId: 'E1',
      sessionId: 's1',
      deviceId: null,
      permissions: ['notification:read:self'],
    });
    expect(result).toEqual({ unreadCount: 3 });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: {
        organisationId: 'org1',
        recipientUserId: 'u1',
        readAt: null,
      },
    });
  });
});
