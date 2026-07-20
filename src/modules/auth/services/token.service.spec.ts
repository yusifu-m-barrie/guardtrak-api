import { TokenService } from './token.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

describe('TokenService', () => {
  const config = {
    get: (key: string) => {
      const map: Record<string, string> = {
        'jwt.accessExpiresIn': '15m',
        'jwt.issuer': 'guardtrak-api',
        'jwt.audience': 'guardtrak-clients',
      };
      return map[key];
    },
    getOrThrow: () => 'test-access-secret-not-for-prod',
  } as unknown as ConfigService;

  const jwt = new JwtService({ secret: 'test-access-secret-not-for-prod' });
  const service = new TokenService(jwt, config);

  it('hashes opaque tokens deterministically', () => {
    const a = service.hashOpaqueToken('abc');
    const b = service.hashOpaqueToken('abc');
    expect(a).toBe(b);
    expect(a).not.toBe('abc');
  });

  it('generates numeric OTPs of fixed length', () => {
    expect(service.generateNumericOtp(6)).toMatch(/^\d{6}$/);
  });

  it('computes expiry from duration strings', () => {
    const expires = service.expiresAtFromDuration('15m');
    expect(expires.getTime()).toBeGreaterThan(Date.now());
  });
});
