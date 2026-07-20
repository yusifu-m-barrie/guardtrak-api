# Database Schema Overview

GuardTrak Phase 2 introduces the PostgreSQL schema for multi-organisation workforce operations.

## Tenancy

- Most operational tables include `organisationId`.
- Platform `SUPER_ADMIN` users may have `organisationId = null`.
- Application services (Phase 3+) must scope queries by organisation for non-platform roles.
- Row-level security is **not** implemented yet; it is a future hardening option.

## Identity and time

| Convention | Detail |
|------------|--------|
| Primary keys | UUID (`@db.Uuid`) |
| Timestamps | `timestamptz(3)`, stored/interpreted as UTC on the backend |
| Soft delete | `deletedAt` on organisations, users, profiles, clients, sites, shifts, attendance, routes, checkpoints, incidents, evidence |
| Device vs server time | Dual fields such as `clockInDeviceAt` / `clockInServerAt`, `visitedAtDevice` / `visitedAtServer` |

## Evidence storage

PostgreSQL stores **metadata only** (`storageProvider`, `storageBucket`, `storageKey`, mime, size, checksum). Binary files live in S3-compatible object storage. Orphaned `PENDING_UPLOAD` rows should be cleaned by a future job after TTL.

## Attendance ↔ Evidence

`Attendance.clockInEvidenceId` / `clockOutEvidenceId` and `PatrolVisit.evidenceId` are **soft UUID references** (no Prisma FK) to avoid circular relation graphs. `Evidence` holds formal optional FKs to parents (`incidentId`, `attendanceId`, `patrolVisitId`, `emergencyId`, `supportRequestId`).

## Incident people/witnesses

`peopleInvolved` and `witnesses` are controlled JSON arrays for Phase 2. A normalised `IncidentPerson` table can replace them later without changing incident identity fields.

## Officer skills

`OfficerProfile.skills` is JSON (certifications/skills list). A relational skills catalogue can be added later.

## Idempotency

`IdempotencyRecord` stores operation outcomes for offline-safe retries. `responseBody` must never contain secrets, tokens, or evidence binaries. Expired rows should be purged by a scheduled cleanup job.

## PostGIS (future)

Sites, checkpoints, and attendance events store `Decimal(10,7)` coordinates today so PostGIS geography columns/indexes can be added later without redesigning tenancy or entity IDs.

## Auth note

Schema includes `User.passwordHash`, `RefreshSession.tokenHash`, and `PasswordResetToken.tokenHash` only. Authentication APIs are deferred to Phase 3.
