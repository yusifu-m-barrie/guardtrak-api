import { RealtimePublisher } from './realtime.publisher';
import { RealtimeGateway } from './realtime.gateway';
import { REALTIME_EVENTS } from './realtime.events';

describe('RealtimePublisher', () => {
  it('publishes events to organisation rooms', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const gateway = {
      getServer: jest.fn().mockReturnValue({ to }),
    } as unknown as RealtimeGateway;

    const publisher = new RealtimePublisher(gateway);
    const payload = { organisationId: 'org-1', incidentId: 'inc-1' };

    publisher.publish('org-1', REALTIME_EVENTS.INCIDENT_CREATED, payload);

    expect(to).toHaveBeenCalledWith('org:org-1');
    expect(emit).toHaveBeenCalledWith(
      REALTIME_EVENTS.INCIDENT_CREATED,
      payload,
    );
  });

  it('no-ops when gateway server is unavailable', () => {
    const gateway = {
      getServer: jest.fn().mockReturnValue(null),
    } as unknown as RealtimeGateway;

    const publisher = new RealtimePublisher(gateway);

    expect(() =>
      publisher.publish('org-1', REALTIME_EVENTS.DASHBOARD_REFRESH, {
        organisationId: 'org-1',
      }),
    ).not.toThrow();
  });
});
