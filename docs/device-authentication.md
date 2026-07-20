# Device Authentication

On login, devices are upserted by unique `installationId`.

MVP policy:

- Development/test: new devices auto-activate (`AUTH_NEW_DEVICE_AUTO_APPROVE`).
- Staging/production: new devices stay `PENDING` and login returns `403 AUTH_DEVICE_PENDING` with no tokens until an administrator approves the device.
- Blocked/revoked devices cannot sign in.
- An installation registered to another user/org is rejected.

Push tokens are deferred to the notifications phase.
