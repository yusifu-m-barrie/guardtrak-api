# Attendance State Machine

See `attendance-transitions.util.ts` for authoritative transitions.

Key paths:

- Clock-in: `PENDING` → `CLOCKED_IN` | `APPROVED_WITH_WARNING` | `PENDING_SUPERVISOR_APPROVAL`
- Clock-out: active → `CLOCKED_OUT` (or pending approval if outside geofence under review policy)
- Review: pending/warning/clocked-out → `SUPERVISOR_APPROVED` | `SUPERVISOR_REJECTED`
- Correct: recalculates totals; preserves originals in `AttendanceEvent` metadata
- Void: → `VOIDED` (admin); no physical delete

Invalid transitions → 409 `ATTENDANCE_STATUS_TRANSITION_INVALID`.
