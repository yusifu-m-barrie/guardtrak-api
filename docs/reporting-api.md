# Reporting API (Phase 7)

All require `report:read` (supervisor + admin).

| Method | Path |
|--------|------|
| GET | `/reports/dashboard` |
| GET | `/reports/attendance` |
| GET | `/reports/incidents` |
| GET | `/reports/patrols` |
| GET | `/reports/emergency` |

Aggregations via Prisma `groupBy` / `count`. CSV/PDF export returns stub `{ exportFormat: "csv", status: "not_implemented" }`.
