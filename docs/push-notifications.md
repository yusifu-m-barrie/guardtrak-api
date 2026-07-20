# Push Notifications

Mobile push is optional and disabled by default in development (`FCM_ENABLED=false`, `APNS_ENABLED=false`).

## Firebase Cloud Messaging (Android / cross-platform)

| Variable | Description |
|----------|-------------|
| `FCM_ENABLED` | Enable FCM delivery |
| `FCM_PROJECT_ID` | Firebase project ID |
| `FCM_CLIENT_EMAIL` | Service account email |
| `FCM_PRIVATE_KEY` | Service account private key (use `\n` for newlines in `.env`) |

Register device tokens via `POST /api/v1/notifications/push-tokens`. The notifications module queues delivery when push is enabled.

## Apple Push Notification service (iOS)

| Variable | Description |
|----------|-------------|
| `APNS_ENABLED` | Enable APNs delivery |
| `APNS_KEY_ID` | APNs auth key ID |
| `APNS_TEAM_ID` | Apple Developer team ID |
| `APNS_BUNDLE_ID` | App bundle identifier |
| `APNS_KEY_PATH` | Path to `.p8` key inside the container/host |

## Behaviour

- When disabled, in-app notifications and database records still work; push providers no-op.
- Production secrets must be mounted securely (env or secret manager), never committed.

See also [notification-api.md](./notification-api.md) and [bullmq-queues.md](./bullmq-queues.md).
