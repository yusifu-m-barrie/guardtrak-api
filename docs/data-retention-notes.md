# Data Retention Notes

These are planning notes for later policy implementation — not automated retention jobs.

| Data class | Guidance |
|------------|----------|
| Attendance / breaks / patrol visits | Retain for operational and compliance reporting; soft-delete rare |
| Incidents / evidence metadata | Long retention; evidence binaries follow storage lifecycle policies |
| SOS emergencies | Retain resolved history for audit |
| Refresh sessions | Delete/revoke on expiry and logout |
| Password reset tokens | Short TTL; purge consumed/expired |
| Idempotency records | Purge after `expiresAt` |
| Sync conflicts | Retain until resolved + grace period |
| Audit logs | Append-only; longer retention than transactional tables |
| Push tokens | Invalidate and remove inactive tokens |

## Audit exclusions

Never persist passwords, OTPs, refresh tokens, evidence binaries, or unnecessary high-frequency GPS trails in `AuditLog`.
