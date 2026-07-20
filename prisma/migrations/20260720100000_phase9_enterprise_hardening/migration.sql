-- Phase 9: Enterprise hardening
-- Password history, device trust score, session fingerprint, org storage quotas, audit actions

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PASSWORD_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SECURITY_EVENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CACHE_CLEAR';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'QUEUE_RETRY';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ADMIN_ACTION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SESSION_REVOKE';

ALTER TABLE "organisations"
  ADD COLUMN IF NOT EXISTS "storageQuotaBytes" BIGINT,
  ADD COLUMN IF NOT EXISTS "storageUsedBytes" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "devices"
  ADD COLUMN IF NOT EXISTS "trustScore" INTEGER NOT NULL DEFAULT 50;

ALTER TABLE "refresh_sessions"
  ADD COLUMN IF NOT EXISTS "fingerprint" TEXT;

CREATE TABLE IF NOT EXISTS "password_histories" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_histories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "password_histories_userId_createdAt_idx"
  ON "password_histories"("userId", "createdAt" DESC);

DO $$ BEGIN
  ALTER TABLE "password_histories"
    ADD CONSTRAINT "password_histories_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
