# Offline Attendance Notes

Phase 5 prepares mobile offline retries without implementing sync-batch.

## Client should send

- `deviceTimestamp` (audit only; server time is authoritative)
- `localAttendanceId` / `localBreakId` for reconciliation
- `idempotencyKey` stable across retries
- JWT `deviceId` / installation from login

## Server behaviour

- Reject device timestamps outside `ATTENDANCE_DEVICE_TIME_TOLERANCE_MINUTES`
- Never trust client-computed distance or totals
- Safe retries via idempotency
- Clock-in early window: `ATTENDANCE_CLOCK_IN_EARLY_MINUTES`

Full sync-batch and conflict resolution: Phase 9.
