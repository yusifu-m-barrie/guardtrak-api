# Tenant Auth Context

Organisation users always have `organisationId` on the JWT/`RequestUser`.

`SUPER_ADMIN` may have `organisationId = null` and logs in with `organisationCode=PLATFORM`.

Ordinary repositories must still filter by organisation for org roles. Super-admin cross-tenant access requires explicit platform services — not automatic bypass of org filters.

PostgreSQL RLS is not implemented yet.
