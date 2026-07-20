# Attendance Calculations

`AttendanceCalculationService` uses **server** timestamps only.

| Field | Rule |
|-------|------|
| `grossMinutes` | floor((clockOutServerAt - clockInServerAt) / 60s), ≥ 0 |
| `totalBreakMinutes` | sum completed break durations |
| `payableMinutes` | max(0, grossMinutes - unpaidBreakMinutes) |
| `lateMinutes` | minutes after scheduledStartAt + gracePeriodMinutes |
| `earlyDepartureMinutes` | minutes before scheduledEndAt |
| `overtimeMinutes` | max(0, gross - scheduledDuration - overtimeThreshold) |

Rounding: floor to whole minutes; never negative. Device timestamps retained for audit only. Overnight shifts use UTC instants. Not payroll/wages.
