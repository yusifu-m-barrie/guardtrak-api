-- Phase 5: shift cancellation metadata, break cancellation, attendance query index
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ(3);
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "cancelledByUserId" UUID;

ALTER TABLE "shift_breaks" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE "shift_breaks" ADD COLUMN IF NOT EXISTS "cancelledByUserId" UUID;

CREATE INDEX IF NOT EXISTS "attendances_organisationId_officerId_status_idx" ON "attendances"("organisationId", "officerId", "status");

DO $$ BEGIN
  ALTER TABLE "shifts" ADD CONSTRAINT "shifts_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shift_breaks" ADD CONSTRAINT "shift_breaks_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
