import 'reflect-metadata';

// E2E suites register fresh installationIds per run; auto-approve must be on
// so login smoke paths receive JWTs. Production/demo .env keeps this false.
process.env.AUTH_NEW_DEVICE_AUTO_APPROVE = 'true';
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
  process.env.NODE_ENV = 'test';
}
