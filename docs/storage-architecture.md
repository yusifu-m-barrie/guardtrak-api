# Storage Architecture (Phase 7)

- Interface: `StorageProvider` (`createUploadUrl`, `completeUpload`, `deleteObject`, `getPublicUrl`, `getSignedDownloadUrl`)
- Implementations: `LocalStorageProvider` (dev), `S3Provider` / `CloudflareR2Provider` (stubs → 501)
- Selection via `STORAGE_PROVIDER` (`local` | `s3` | `minio` | `r2`)
- Config: `STORAGE_LOCAL_ROOT`, `STORAGE_SIGNED_URL_TTL_SECONDS`, bucket/credentials for cloud
- Objects live under `{STORAGE_LOCAL_ROOT}/objects/{org}/incidents/...`
