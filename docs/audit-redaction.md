# Audit Redaction

Phase 4 mutations write append-only `AuditLog` rows via `AuthAuditService`. Sensitive data must not appear in API responses, logs, or audit metadata.

## API response exclusions

Mappers intentionally omit:

| Field | Entities |
|-------|----------|
| `passwordHash` | User (all endpoints) |
| `nationalIdNumber`, `dateOfBirth` | Officer profile (stored; never returned) |
| `deletedAt`, lockout internals | User, profiles, clients, sites |
| Push token values | Device (tokens not in device API) |

Officer `notes` returned to administrators only.

## Audit metadata rules

**Do persist:** entity IDs, action type, status transitions, changed field **names**, assignment IDs, timestamps, `requestId`, actor ID.

**Do not persist in `metadata`:**

- Passwords, temporary passwords, password hashes
- OTP or reset tokens
- Refresh/access tokens
- Raw `nationalIdNumber` or full date-of-birth values
- Push notification tokens
- Evidence binaries or high-frequency GPS trails

Example safe user create audit:

```json
{
  "employeeId": "OFF-003",
  "email": "officer3@example.com",
  "role": "SECURITY_OFFICER",
  "status": "ACTIVE"
}
```

Example officer update audit:

```json
{ "changedFields": ["phone", "emergencyContactPhone"] }
```

National ID or DOB changes appear only as field names in `changedFields`, not values.

## HTTP / application logging

`redact.util.ts` masks header/body keys matching sensitive patterns (`password`, `token`, `secret`, `authorization`, etc.) in request logging. Production never logs stack traces with secrets (see [error-contract.md](./error-contract.md)).

## Audit failure behaviour

Audit write failures are swallowed (soft-fail) so primary operations still complete; failures are not echoed to clients with secret-bearing details.

## Related

- [data-retention-notes.md](./data-retention-notes.md)
- [security-notes.md](./security-notes.md)
- [officer-management-api.md](./officer-management-api.md)
