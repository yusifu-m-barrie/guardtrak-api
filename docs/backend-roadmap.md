# GuardTrak Backend Roadmap

## Phase 1: Foundation

Application bootstrap, config validation, Prisma foundation, health checks, response/error contracts, security placeholders, logging, pagination, idempotency architecture, docs, and tests.

## Phase 2: Database Schema

PostgreSQL schema for organisations, users, roles, sites, shifts, attendance, patrols, incidents, evidence, notifications, devices, sync, audit logs, and migrations. **Complete.**

## Phase 3: Authentication and Permissions

JWT access/refresh tokens, Argon2 password hashing, Passport strategies, role/permission enforcement, invite/activation flows. **Complete (invite activation deferred).**

## Phase 4: Organisation Data

Companies, clients, sites, officers, supervisors, and administrator management APIs. **Complete.**

Delivered:

- Self-service organisation profile (`GET/PATCH /organisation`)
- User lifecycle (create, list, profile, role/status, unlock, force password reset, archive)
- Officer and supervisor CRUD with transactional user+profile create and supervisor-officer assignments
- Client and site management with geofence fields and client archive guards
- Device administrator controls (status transitions, revoke, session invalidation)
- Tenant scoping, Phase 4 permission map, soft-delete policy, and audit redaction docs

Platform cross-tenant org endpoints remain deferred. Shift/site archive constraints and geofence enforcement are Phase 5.

## Phase 5: Shifts, Assignments, Attendance and Breaks

**Complete.**

Delivered:

- Shift CRUD, status transitions, soft archive; cancel cascades to assignments
- Assignment create/batch/current/upcoming/confirm/reassign with overlap detection
- Clock-in/out with Haversine geofence, GPS accuracy reject, device time tolerance
- Attendance review/approve/reject/correct/void with AttendanceEvent history
- Break start/end/cancel with idempotency; active break blocks clock-out
- Prisma migration `phase5_shift_attendance` (cancel metadata + attendance index)
- Phase 5 permission map and docs under `docs/*`

Patrols, incidents, evidence uploads, notifications, SOS, reporting, platform org APIs, and mobile sync-batch remain deferred.

## Phase 6: Patrols

**Complete.**

Delivered:

- Patrol route CRUD/status/archive with activation guards (checkpoints, QR, contiguous sequences)
- Checkpoint CRUD/batch/reorder/archive; QR hashed at rest; responses expose `qrRequired` only
- Patrol assignment create/batch with immutable `PatrolAssignmentCheckpoint` snapshots + events
- Start/complete/cancel/mark-missed with attendance, device, time-window, and idempotency checks
- Checkpoint visits with GPS/QR/GPS_AND_QR verification, sequential enforcement, review/override
- Progress recalculation via `PatrolProgressService`; Phase 6 permissions and PATROL_* config
- Seed updated for verification methods, QR hashes, snapshots, and visit snapshot linkage
- Docs:
  - `docs/phase6-permissions.md`
  - `docs/patrol-qr-security.md`
  - `docs/patrol-verification.md`
  - `docs/patrol-route-api.md`
  - `docs/patrol-checkpoint-api.md`
  - `docs/patrol-assignment-api.md`
  - `docs/patrol-visit-api.md`
  - `docs/patrol-progress.md`
  - `docs/patrol-state-machine.md`
  - `docs/patrol-idempotency.md`
  - `docs/offline-patrol-notes.md`

## Phase 7: Operations Platform — Complete

Delivered as a combined ops slice (incidents, evidence/storage, notifications, SOS, support/FAQ, reporting aggregates, offline sync batch):

- Schema migration `phase7_operations` (priority, evidence verification, FAQ, FALSE_ALARM, support category, etc.)
- Modules: `storage`, `incidents`, `evidence`, `notifications`, `emergencies`, `support`, `reports`, `sync`
- Docs: `incident-api.md`, `evidence-api.md`, `storage-architecture.md`, `notification-api.md`, `sos-api.md`, `support-api.md`, `reporting-api.md`, `sync-api.md`, `phase7-permissions.md`, `offline-sync-notes.md`
- E2E: `test/phase7-operations.e2e-spec.ts`

## Phase 8: Production Infrastructure — Complete

Delivered:

- Cloud storage: S3 + Cloudflare R2 providers (presigned upload/download, HEAD verify, hooks placeholders); local unchanged; env-based selection
- Push: FCM provider + APNs placeholder; device token delivery path; inactive token handling
- Email: SMTP + Resend/SES placeholders; HTML/text templates (reset, welcome, support, incident, SOS)
- Redis with in-memory fallback; BullMQ queues with in-memory fallback (notifications, emails, evidence, reports, cleanup, sync retries, DLQ)
- WebSockets gateway (`/realtime`) with JWT auth and org rooms; domain event forwarding
- Observability: `/health`, `/health/live`, `/health/ready`, `/metrics`; request metrics interceptor
- Security/perf: compression, trust proxy, Helmet CSP tuning, API key placeholder module
- Docker: optional multi-stage Dockerfile and Compose (profiles avoid conflicting with local PostgreSQL 18); PM2 + Nginx primary for production
- CI: GitHub Actions lint/unit/e2e/build + Docker/deploy placeholders
- Docs: Mode A/B deployment, environment, postgresql-backup, docker (optional), nginx/ssl under `deploy/`, plus Phase 8 infra guides
- E2E: `test/phase8-infra.e2e-spec.ts`
- Phase 8 env vars in `.env.example` / `docs/environment.md`

## Phase 9: Enterprise Hardening — Complete

Delivered:

- Cache module (Redis + in-memory fallback) with admin stats/clear
- SUPER_ADMIN platform admin API (`/api/v1/admin/*`) — system, health, metrics, cache, storage, queues
- Password history (last 5, configurable) and optional max password age
- Session fingerprint + optional strict mode; refresh family reuse detection hardened
- Device trust score on login lifecycle
- Evidence quotas, checksum duplicate detection, virus-scan/thumbnail hooks
- Expanded cleanup queue jobs (sessions, OTP, devices, stubs)
- Domain/cache/Redis/memory metrics; API version response headers
- Prisma migration `phase9_enterprise_hardening`
- Docs: `security-guide.md`, `operations-manual.md`, `administrator-guide.md`, `performance-guide.md`, `scaling-guide.md`, `maintenance-guide.md`, `recovery-guide.md`, `production.env.example`, updated `api-versioning.md` / `environment.md`
- Scripts: `backup-database`, `restore-database`, `backup-storage` (PowerShell + Bash)
- E2E: `test/phase9-admin.e2e-spec.ts`

## Phase 10: Mobile Integration

Contract alignment with the officer mobile app, staging soak tests, release coordination. **Do not start until Phase 10 is approved.**

## Phase 11: Supervisor/Admin Web

Web dashboard APIs and operational reporting surfaces for supervisors and administrators.
