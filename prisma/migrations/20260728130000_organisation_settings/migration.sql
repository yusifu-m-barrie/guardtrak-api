-- Organisation settings JSON (used by org admin + selected on login tenancy lookup)
ALTER TABLE "organisations"
  ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}';
