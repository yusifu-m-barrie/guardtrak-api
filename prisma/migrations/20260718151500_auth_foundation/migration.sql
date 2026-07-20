-- CreateEnum
CREATE TYPE "PasswordResetPurpose" AS ENUM ('OTP', 'RESET_TOKEN');

-- AlterTable organisations: add login tenancy code
ALTER TABLE "organisations" ADD COLUMN "code" TEXT;

UPDATE "organisations"
SET "code" = 'GUARDTRAK'
WHERE "code" IS NULL;

ALTER TABLE "organisations" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "organisations_code_key" ON "organisations"("code");

-- AlterTable password_reset_tokens
ALTER TABLE "password_reset_tokens" ADD COLUMN "purpose" "PasswordResetPurpose" NOT NULL DEFAULT 'OTP';

DROP INDEX IF EXISTS "password_reset_tokens_userId_idx";

CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

CREATE INDEX "password_reset_tokens_userId_purpose_idx" ON "password_reset_tokens"("userId", "purpose");

-- AlterTable refresh_sessions: unique token hash
DROP INDEX IF EXISTS "refresh_sessions_tokenHash_idx";

CREATE UNIQUE INDEX "refresh_sessions_tokenHash_key" ON "refresh_sessions"("tokenHash");
