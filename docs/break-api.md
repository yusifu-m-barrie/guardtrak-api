# Break API

Base path: `/api/v1/breaks`

| Method | Path | Permission |
|--------|------|------------|
| POST | `/breaks/start` | `break:start:self` |
| POST | `/breaks/:id/end` | `break:end:self` |
| GET | `/breaks/current` | `break:read:self` |
| GET | `/breaks/me` | `break:read:self` |
| GET | `/breaks` | `break:read` |
| GET | `/breaks/:id` | self or `break:read` |
| POST | `/breaks/:id/cancel` | officer (short window) or reviewer |

Rules:

- Attendance must be active
- Only one ACTIVE break at a time
- Cancelled breaks do not count toward `totalBreakMinutes`
- Start/end use idempotency keys
- Active break blocks clock-out (`ATTENDANCE_ACTIVE_BREAK_EXISTS`)
