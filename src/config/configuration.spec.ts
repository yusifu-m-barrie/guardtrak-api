import configuration from './configuration';

describe('configuration attendance.geofenceEnabled', () => {
  const originalFlag = process.env.ATTENDANCE_GEOFENCE_ENABLED;
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.ATTENDANCE_GEOFENCE_ENABLED;
    } else {
      process.env.ATTENDANCE_GEOFENCE_ENABLED = originalFlag;
    }
    process.env.NODE_ENV = originalEnv;
  });

  it('defaults to false in development when unset', () => {
    delete process.env.ATTENDANCE_GEOFENCE_ENABLED;
    process.env.NODE_ENV = 'development';
    expect(configuration().attendance.geofenceEnabled).toBe(false);
  });

  it('defaults to true in production when unset', () => {
    delete process.env.ATTENDANCE_GEOFENCE_ENABLED;
    process.env.NODE_ENV = 'production';
    expect(configuration().attendance.geofenceEnabled).toBe(true);
  });

  it('honours an explicit false flag in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ATTENDANCE_GEOFENCE_ENABLED = 'false';
    expect(configuration().attendance.geofenceEnabled).toBe(false);
  });

  it('honours an explicit true flag in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.ATTENDANCE_GEOFENCE_ENABLED = 'true';
    expect(configuration().attendance.geofenceEnabled).toBe(true);
  });
});
