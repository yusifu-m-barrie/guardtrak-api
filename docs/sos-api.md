# SOS / Emergency API (Phase 7)

Base: `/api/v1/emergency`

| Method | Path | Permission |
|--------|------|------------|
| POST | `/emergency/sos` | `sos:create:self` (idempotent) |
| GET | `/emergency` | scoped |
| GET | `/emergency/history` | scoped |
| GET | `/emergency/:id` | scoped |
| PATCH | `/emergency/:id/status` | `emergency:manage` |

API status `ACTIVE` maps to DB `CREATED`. Transitions include `FALSE_ALARM`. SOS notifies supervisors + admins (`SOS_ALERT`).
