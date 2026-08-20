-- Convert existing one-off (NONE) shifts that are already assigned to officers
-- into DAILY time routines so the same start/end times occur every day.
-- Preserves scheduledStartAt, scheduledEndAt, site, title, and all assignment rows.

UPDATE shifts AS s
SET
  "recurrenceType" = 'DAILY',
  "recurrenceDaysOfWeek" = '{}',
  "recurrenceEndAt" = NULL,
  timezone = COALESCE(
    NULLIF(BTRIM(s.timezone), ''),
    (
      SELECT o.timezone
      FROM organisations AS o
      WHERE o.id = s."organisationId"
    ),
    'Africa/Freetown'
  ),
  "updatedAt" = NOW()
WHERE s."deletedAt" IS NULL
  AND s."recurrenceType" = 'NONE'
  AND EXISTS (
    SELECT 1
    FROM assignments AS a
    WHERE a."shiftId" = s.id
      AND a.status NOT IN ('CANCELLED', 'REASSIGNED')
  );
