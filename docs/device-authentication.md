# Device Authentication

On login, devices are upserted by unique `installationId`.

Policy:

- **WEB (dashboard browser):** auto-activates by default (`AUTH_WEB_DEVICE_AUTO_APPROVE=true`) so the first administrator is not locked out before they can open Devices.
- **Mobile (IOS/ANDROID):** in staging/production stays `PENDING` until an administrator approves (`AUTH_NEW_DEVICE_AUTO_APPROVE=false`). Login returns `403 AUTH_DEVICE_PENDING` with no tokens.
- Development/test: mobile devices also auto-activate when `AUTH_NEW_DEVICE_AUTO_APPROVE=true`.
- Blocked/revoked devices cannot sign in.
- An installation registered to another user/org is rejected when ownership enforcement is on.

Push tokens are deferred to the notifications phase.
