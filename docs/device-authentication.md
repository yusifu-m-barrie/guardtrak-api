# Device Authentication

On login, devices are upserted by unique `installationId`.

MVP policy:

- Development/test: new devices auto-activate (`AUTH_NEW_DEVICE_AUTO_APPROVE`).
- Blocked/revoked devices cannot sign in.
- An installation registered to another user/org is rejected.

Push tokens are deferred to the notifications phase.
