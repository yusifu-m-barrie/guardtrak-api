-- Phase 6: patrol management (snapshots, QR hash, verification, events)

ALTER TABLE "patrol_routes" ADD COLUMN IF NOT EXISTS "requireSequentialCompletion" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "patrol_checkpoints" ADD COLUMN IF NOT EXISTS "verificationMethod" "CheckpointVerificationMethod" NOT NULL DEFAULT 'GPS';
ALTER TABLE "patrol_checkpoints" ADD COLUMN IF NOT EXISTS "qrCodeHash" TEXT;
ALTER TABLE "patrol_checkpoints" ADD COLUMN IF NOT EXISTS "minimumGpsAccuracyMeters" INTEGER;

ALTER TABLE "patrol_assignments" ADD COLUMN IF NOT EXISTS "startedAtDevice" TIMESTAMPTZ(3);
ALTER TABLE "patrol_assignments" ADD COLUMN IF NOT EXISTS "completedAtDevice" TIMESTAMPTZ(3);
ALTER TABLE "patrol_assignments" ADD COLUMN IF NOT EXISTS "finalNote" TEXT;
ALTER TABLE "patrol_assignments" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE "patrol_assignments" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ(3);
ALTER TABLE "patrol_assignments" ADD COLUMN IF NOT EXISTS "cancelledByUserId" UUID;

ALTER TABLE "patrol_visits" ADD COLUMN IF NOT EXISTS "assignmentCheckpointId" UUID;
ALTER TABLE "patrol_visits" ALTER COLUMN "patrolCheckpointId" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "patrol_assignment_checkpoints" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "patrolAssignmentId" UUID NOT NULL,
    "sourceCheckpointId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "allowedRadiusMeters" INTEGER NOT NULL,
    "verificationMethod" "CheckpointVerificationMethod" NOT NULL,
    "qrCodeHash" TEXT,
    "requiresPhoto" BOOLEAN NOT NULL DEFAULT false,
    "requiresNote" BOOLEAN NOT NULL DEFAULT false,
    "instructions" TEXT,
    "minimumGpsAccuracyMeters" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "patrol_assignment_checkpoints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "patrol_assignment_events" (
    "id" UUID NOT NULL,
    "patrolAssignmentId" UUID NOT NULL,
    "actorUserId" UUID,
    "previousStatus" "PatrolAssignmentStatus",
    "newStatus" "PatrolAssignmentStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "patrol_assignment_events_pkey" PRIMARY KEY ("id")
);

-- Hash existing plaintext QR values (SHA-256 hex via pgcrypto if available; fallback encode digest)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE "patrol_checkpoints"
SET "qrCodeHash" = encode(digest(UPPER(TRIM("qrCodeValue")), 'sha256'), 'hex')
WHERE "qrCodeValue" IS NOT NULL AND ("qrCodeHash" IS NULL OR "qrCodeHash" = '');

DROP INDEX IF EXISTS "patrol_checkpoints_qrCodeValue_key";
CREATE UNIQUE INDEX IF NOT EXISTS "patrol_checkpoints_qrCodeHash_key" ON "patrol_checkpoints"("qrCodeHash");

CREATE UNIQUE INDEX IF NOT EXISTS "patrol_assignment_checkpoints_patrolAssignmentId_sequence_key" ON "patrol_assignment_checkpoints"("patrolAssignmentId", "sequence");
CREATE INDEX IF NOT EXISTS "patrol_assignment_checkpoints_patrolAssignmentId_sequence_idx" ON "patrol_assignment_checkpoints"("patrolAssignmentId", "sequence");
CREATE INDEX IF NOT EXISTS "patrol_assignment_checkpoints_organisationId_idx" ON "patrol_assignment_checkpoints"("organisationId");
CREATE INDEX IF NOT EXISTS "patrol_assignment_events_patrolAssignmentId_createdAt_idx" ON "patrol_assignment_events"("patrolAssignmentId", "createdAt");

DROP INDEX IF EXISTS "patrol_visits_patrolAssignmentId_patrolCheckpointId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "patrol_visits_patrolAssignmentId_assignmentCheckpointId_key" ON "patrol_visits"("patrolAssignmentId", "assignmentCheckpointId");

DO $$ BEGIN
  ALTER TABLE "patrol_assignments" ADD CONSTRAINT "patrol_assignments_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "patrol_assignment_checkpoints" ADD CONSTRAINT "patrol_assignment_checkpoints_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "patrol_assignment_checkpoints" ADD CONSTRAINT "patrol_assignment_checkpoints_patrolAssignmentId_fkey" FOREIGN KEY ("patrolAssignmentId") REFERENCES "patrol_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "patrol_assignment_checkpoints" ADD CONSTRAINT "patrol_assignment_checkpoints_sourceCheckpointId_fkey" FOREIGN KEY ("sourceCheckpointId") REFERENCES "patrol_checkpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "patrol_assignment_events" ADD CONSTRAINT "patrol_assignment_events_patrolAssignmentId_fkey" FOREIGN KEY ("patrolAssignmentId") REFERENCES "patrol_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "patrol_assignment_events" ADD CONSTRAINT "patrol_assignment_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "patrol_visits" ADD CONSTRAINT "patrol_visits_assignmentCheckpointId_fkey" FOREIGN KEY ("assignmentCheckpointId") REFERENCES "patrol_assignment_checkpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;