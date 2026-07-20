# Patrol QR Security

## Storage

- Administrators may submit a raw `qrCodeValue` on checkpoint create/update.
- The API stores `qrCodeHash` (`sha256` of trimmed, uppercased value).
- Plaintext `qrCodeValue` may exist for seed/dev migration only and is never returned by API mappers.

## API responses

Route, checkpoint, assignment snapshot, and visit responses expose only:

- `qrRequired: boolean`
- never `qrCodeValue`
- never `qrCodeHash`

## Verification

- Officers submit `qrCodeValue` on visit create.
- Comparison uses `verifyQrCode` (hash + `timingSafeEqual`).
- Raw QR values are excluded from idempotency request hashes (`hasQr` boolean only) and audit metadata.

## Rotation

Changing a QR value updates the checkpoint hash. Active patrol assignments keep immutable snapshot hashes created at assignment time, so in-flight patrols are unaffected until new assignments are created.
