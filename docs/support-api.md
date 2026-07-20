# Support & FAQ API (Phase 7)

| Method | Path | Auth |
|--------|------|------|
| GET | `/help/faq` | Public (global published) |
| GET | `/help/faq/org` | JWT (global + org) |
| POST/PATCH/DELETE | `/help/faq` | `faq:manage` |
| POST/GET | `/support/requests` | create/read self or manage |
| GET | `/support/requests/:id` | author or support:read |
| POST | `/support/requests/:id/messages` | author or support:update |
| PATCH | `/support/requests/:id/status` | `support:update` |

`SupportMessage.organisationId` is required (tenant isolation).
