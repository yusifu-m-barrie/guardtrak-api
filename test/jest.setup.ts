import 'reflect-metadata';

// E2E suites register fresh installationIds per run; auto-approve must be on
// so login smoke paths receive JWTs. Production/demo .env keeps this false.
process.env.AUTH_NEW_DEVICE_AUTO_APPROVE = 'true';
// Existing geofence e2e cases assert production enforcement. Local .env may
// disable it for tester clock-in; e2e must still exercise the enabled path.
process.env.ATTENDANCE_GEOFENCE_ENABLED = 'true';
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
  process.env.NODE_ENV = 'test';
}
