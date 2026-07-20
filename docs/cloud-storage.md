# Cloud Storage

GuardTrak evidence uploads use a pluggable `StorageProvider` selected by `STORAGE_PROVIDER`.

## Providers

| Value | Use case |
|-------|----------|
| `local` | Development — files under `STORAGE_LOCAL_ROOT` |
| `minio` | Local/staging S3-compatible (Docker Compose includes MinIO) |
| `s3` | AWS S3 |
| `r2` | Cloudflare R2 (S3-compatible API) |

## Key variables

- `STORAGE_BUCKET` — bucket name
- `STORAGE_REGION` — AWS/R2 region
- `STORAGE_ENDPOINT` — required for MinIO/R2 (e.g. `http://minio:9000`)
- `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`
- `STORAGE_PUBLIC_URL` — optional CDN/base URL for public objects
- `STORAGE_SIGNED_URL_TTL_SECONDS` — presigned upload/download TTL (default 900)

## Docker (development)

Root or `guardtrak-api` Compose stacks include MinIO on ports `9000` (API) and `9001` (console). Create a bucket (e.g. `guardtrak-evidence`) before enabling cloud uploads.

## Production

Prefer managed object storage (S3 or R2) with IAM-scoped credentials, private buckets, and presigned URLs only. See [deployment.md](./deployment.md) and [storage-architecture.md](./storage-architecture.md).
