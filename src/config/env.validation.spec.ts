import { applyDevelopmentDefaults, validateEnv } from './env.validation';

describe('validateEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/guardtrak',
    JWT_ACCESS_SECRET: 'dev-access-secret-change-me',
    JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me',
  };

  it('applies development defaults and validates numeric fields', () => {
    const validated = validateEnv(
      applyDevelopmentDefaults({
        ...base,
        NODE_ENV: 'development',
        PORT: '4000',
        RATE_LIMIT_LIMIT: '50',
      }),
    );

    expect(validated.PORT).toBe(4000);
    expect(validated.RATE_LIMIT_LIMIT).toBe(50);
    expect(validated.API_PREFIX).toBe('api/v1');
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() =>
      validateEnv(
        applyDevelopmentDefaults({
          NODE_ENV: 'development',
          JWT_ACCESS_SECRET: 'dev-access-secret-change-me',
          JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me',
        }),
      ),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects placeholder JWT secrets in production', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        PORT: 3000,
        API_PREFIX: 'api/v1',
        CORS_ORIGINS: 'https://app.example.com',
        LOG_LEVEL: 'log',
        RATE_LIMIT_TTL: 60000,
        RATE_LIMIT_LIMIT: 100,
        STORAGE_PROVIDER: 'local',
        MAX_IMAGE_SIZE_BYTES: 10485760,
        MAX_VIDEO_SIZE_BYTES: 104857600,
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
      }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('accepts strong secrets in production', () => {
    const validated = validateEnv({
      NODE_ENV: 'production',
      PORT: 3000,
      API_PREFIX: 'api/v1',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/guardtrak',
      JWT_ACCESS_SECRET: 'prod-access-secret-9f3a2c1b',
      JWT_REFRESH_SECRET: 'prod-refresh-secret-8e2b1a0d',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      CORS_ORIGINS: 'https://app.example.com',
      LOG_LEVEL: 'warn',
      RATE_LIMIT_TTL: 60000,
      RATE_LIMIT_LIMIT: 100,
      STORAGE_PROVIDER: 'local',
      MAX_IMAGE_SIZE_BYTES: 10485760,
      MAX_VIDEO_SIZE_BYTES: 104857600,
      AUTH_ALLOW_DEV_OTP_OUTPUT: 'false',
      AUTH_NEW_DEVICE_AUTO_APPROVE: 'false',
    });

    expect(validated.NODE_ENV).toBe('production');
    expect(validated.AUTH_ALLOW_DEV_OTP_OUTPUT).toBe(false);
    expect(validated.AUTH_NEW_DEVICE_AUTO_APPROVE).toBe(false);
  });

  it('does not treat string "false" as true in production (Railway env quirk)', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        PORT: '3000',
        API_PREFIX: 'api/v1',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/guardtrak',
        JWT_ACCESS_SECRET: 'prod-access-secret-9f3a2c1b',
        JWT_REFRESH_SECRET: 'prod-refresh-secret-8e2b1a0d',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        CORS_ORIGINS: 'https://app.example.com',
        LOG_LEVEL: 'warn',
        RATE_LIMIT_TTL: '60000',
        RATE_LIMIT_LIMIT: '100',
        STORAGE_PROVIDER: 'local',
        MAX_IMAGE_SIZE_BYTES: '10485760',
        MAX_VIDEO_SIZE_BYTES: '104857600',
        AUTH_ALLOW_DEV_OTP_OUTPUT: 'false',
        AUTH_NEW_DEVICE_AUTO_APPROVE: 'false',
      }),
    ).not.toThrow();
  });

  it('rejects AUTH_ALLOW_DEV_OTP_OUTPUT=true in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        PORT: 3000,
        API_PREFIX: 'api/v1',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/guardtrak',
        JWT_ACCESS_SECRET: 'prod-access-secret-9f3a2c1b',
        JWT_REFRESH_SECRET: 'prod-refresh-secret-8e2b1a0d',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        CORS_ORIGINS: 'https://app.example.com',
        LOG_LEVEL: 'warn',
        RATE_LIMIT_TTL: 60000,
        RATE_LIMIT_LIMIT: 100,
        STORAGE_PROVIDER: 'local',
        MAX_IMAGE_SIZE_BYTES: 10485760,
        MAX_VIDEO_SIZE_BYTES: 104857600,
        AUTH_ALLOW_DEV_OTP_OUTPUT: 'true',
        AUTH_NEW_DEVICE_AUTO_APPROVE: 'false',
      }),
    ).toThrow(/AUTH_ALLOW_DEV_OTP_OUTPUT/);
  });
});
