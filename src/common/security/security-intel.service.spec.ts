import { SecurityIntelService } from './security-intel.service';

describe('SecurityIntelService', () => {
  const service = new SecurityIntelService();

  it('returns geo-ip placeholder', () => {
    expect(service.lookupGeoIp('1.2.3.4')).toEqual({
      country: null,
      region: null,
      provider: 'none',
    });
  });

  it('returns neutral IP reputation placeholder', () => {
    expect(service.scoreIpReputation('1.2.3.4')).toEqual({
      score: 50,
      flagged: false,
      provider: 'none',
    });
  });
});
