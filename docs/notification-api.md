# Notification API (Phase 7)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/notifications` | `notification:read:self` |
| GET | `/notifications/unread-count` | `notification:read:self` |
| POST | `/notifications/read-all` | `notification:read:self` |
| POST | `/notifications/:id/read` | `notification:read:self` |
| GET/PUT | `/notifications/preferences` | `notification:update:self` |
| POST | `/devices/push-token` | `device:push-token:self` |
| POST | `/notifications/broadcast` | `notification:broadcast` |

`NotificationsService.createAndDeliver` always writes in-app delivery; push is stubbed as QUEUED→SENT without FCM. Real push providers deferred to Phase 8.
