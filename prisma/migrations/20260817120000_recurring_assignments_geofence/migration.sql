-- Recurring shift templates, multi-day attendance per assignment,
-- and geofence-enforcement audit flag.

CREATE TYPE "RecurrenceType" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'CUSTOM_WEEKDAYS');

ALTER TABLE "shifts"
  ADD COLUMN "recurrenceType" "RecurrenceType" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "recurrenceEndAt" TIMESTAMPTZ(3),
  ADD COLUMN "recurrenceDaysOfWeek" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "timezone" TEXT;

ALTER TABLE "assignments"
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "attendances"
  ADD COLUMN "occurrenceDate" DATE,
  ADD COLUMN "geofenceEnforcementDisabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "attendances"
SET "occurrenceDate" = (("clockInServerAt" AT TIME ZONE 'UTC')::date)
WHERE "occurrenceDate" IS NULL
  AND "clockInServerAt" IS NOT NULL;

UPDATE "attendances"
SET "occurrenceDate" = (("createdAt" AT TIME ZONE 'UTC')::date)
WHERE "occurrenceDate" IS NULL;

ALTER TABLE "attendances"
  ALTER COLUMN "occurrenceDate" SET NOT NULL;

DROP INDEX IF EXISTS "attendances_assignmentId_key";

CREATE UNIQUE INDEX "attendances_assignmentId_occurrenceDate_key"
  ON "attendances"("assignmentId", "occurrenceDate");
