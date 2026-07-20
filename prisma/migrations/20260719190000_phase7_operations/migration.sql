-- Phase 7: Incident ops enhancements, evidence verification, FAQ, SOS FALSE_ALARM, support category

-- IncidentPriority
CREATE TYPE "IncidentPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- SupportRequestCategory
CREATE TYPE "SupportRequestCategory" AS ENUM ('GENERAL', 'TECHNICAL', 'ACCOUNT', 'BILLING', 'DEVICE', 'OTHER');

-- EmergencyStatus: FALSE_ALARM
ALTER TYPE "EmergencyStatus" ADD VALUE IF NOT EXISTS 'FALSE_ALARM';

-- NotificationType extensions
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MAINTENANCE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUPPORT_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BROADCAST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUPERVISOR_ALERT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ADMIN_ALERT';

-- Incident columns
ALTER TABLE "incidents"
  ADD COLUMN IF NOT EXISTS "priority" "IncidentPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "weatherNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "patrolAssignmentId" UUID;

CREATE INDEX IF NOT EXISTS "incidents_assignedSupervisorId_idx" ON "incidents"("assignedSupervisorId");
CREATE INDEX IF NOT EXISTS "incidents_patrolAssignmentId_idx" ON "incidents"("patrolAssignmentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'incidents_patrolAssignmentId_fkey'
  ) THEN
    ALTER TABLE "incidents"
      ADD CONSTRAINT "incidents_patrolAssignmentId_fkey"
      FOREIGN KEY ("patrolAssignmentId") REFERENCES "patrol_assignments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Evidence verification / soft-delete actor / thumbnail
ALTER TABLE "evidences"
  ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verifiedByUserId" UUID,
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "deletedByUserId" UUID,
  ADD COLUMN IF NOT EXISTS "thumbnailKey" TEXT;

CREATE INDEX IF NOT EXISTS "evidences_emergencyId_idx" ON "evidences"("emergencyId");
CREATE INDEX IF NOT EXISTS "evidences_supportRequestId_idx" ON "evidences"("supportRequestId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidences_verifiedByUserId_fkey'
  ) THEN
    ALTER TABLE "evidences"
      ADD CONSTRAINT "evidences_verifiedByUserId_fkey"
      FOREIGN KEY ("verifiedByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidences_deletedByUserId_fkey'
  ) THEN
    ALTER TABLE "evidences"
      ADD CONSTRAINT "evidences_deletedByUserId_fkey"
      FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Support category
ALTER TABLE "support_requests"
  ADD COLUMN IF NOT EXISTS "category" "SupportRequestCategory" NOT NULL DEFAULT 'GENERAL';

-- SupportMessage organisationId
ALTER TABLE "support_messages"
  ADD COLUMN IF NOT EXISTS "organisationId" UUID;

UPDATE "support_messages" sm
SET "organisationId" = sr."organisationId"
FROM "support_requests" sr
WHERE sm."supportRequestId" = sr.id
  AND sm."organisationId" IS NULL;

-- If still null (empty table), allow null temporarily then set NOT NULL only when all filled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "support_messages" WHERE "organisationId" IS NULL) THEN
    -- leave nullable for safety
    NULL;
  ELSE
    ALTER TABLE "support_messages" ALTER COLUMN "organisationId" SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "support_messages_organisationId_idx" ON "support_messages"("organisationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_messages_organisationId_fkey'
  ) THEN
    ALTER TABLE "support_messages"
      ADD CONSTRAINT "support_messages_organisationId_fkey"
      FOREIGN KEY ("organisationId") REFERENCES "organisations"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- FAQ articles
CREATE TABLE IF NOT EXISTS "faq_articles" (
  "id" UUID NOT NULL,
  "organisationId" UUID,
  "category" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "published" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "deletedAt" TIMESTAMPTZ(3),
  CONSTRAINT "faq_articles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "faq_articles_organisationId_published_idx" ON "faq_articles"("organisationId", "published");
CREATE INDEX IF NOT EXISTS "faq_articles_deletedAt_idx" ON "faq_articles"("deletedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'faq_articles_organisationId_fkey'
  ) THEN
    ALTER TABLE "faq_articles"
      ADD CONSTRAINT "faq_articles_organisationId_fkey"
      FOREIGN KEY ("organisationId") REFERENCES "organisations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
