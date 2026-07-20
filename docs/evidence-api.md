# Evidence API (Phase 7)

Nested under incidents: `/api/v1/incidents/:incidentId/evidence`.

| Method | Path | Permission |
|--------|------|------------|
| POST | `.../upload-url` | `evidence:upload:self` |
| POST | `.../complete` | `evidence:upload:self` |
| GET | `.../` | read self or `evidence:read` |
| DELETE | `.../:evidenceId` | `evidence:delete` (soft) |
| POST | `.../:evidenceId/verify` | `evidence:verify` |

Upload flow returns `{ evidenceId, uploadUrl, storageKey, expiresAt }`. Binary never stored in Postgres — only metadata. Local provider accepts `localTicketId` + `localFileBase64` on complete for e2e/dev.
