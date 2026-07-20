# Attendance API

Base path: `/api/v1/attendance`

## Endpoints

| Method | Path | Permission |
|--------|------|------------|
| POST | `/attendance/clock-in` | `attendance:clock-in:self` |
| POST | `/attendance/clock-out` | `attendance:clock-out:self` |
| GET | `/attendance/current` | `attendance:read:self` |
| GET | `/attendance/me` | `attendance:read:self` |
| GET | `/attendance` | `attendance:read` |
| GET | `/attendance/:id` | self / supervisor / admin |
| POST | `/attendance/:id/request-review` | officer self |
| POST | `/attendance/:id/approve` | `attendance:approve` |
| POST | `/attendance/:id/reject` | `attendance:review` |
| POST | `/attendance/:id/correct` | `attendance:correct` |
| POST | `/attendance/:id/void` | `attendance:void` |

Clock-in/out require an ACTIVE device on the JWT session, idempotency keys, and server-side geofence/GPS/time validation.

See: [geofence-validation.md](./geofence-validation.md), [attendance-calculations.md](./attendance-calculations.md), [attendance-idempotency.md](./attendance-idempotency.md)
