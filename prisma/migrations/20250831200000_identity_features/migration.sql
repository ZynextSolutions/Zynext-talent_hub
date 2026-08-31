-- AlterEnum
ALTER TYPE "OneTimeTokenPurpose" ADD VALUE IF NOT EXISTS 'MFA_LOGIN';
ALTER TYPE "OneTimeTokenPurpose" ADD VALUE IF NOT EXISTS 'SSO_EXCHANGE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_secret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_secret_pending" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "login_lockouts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_lockouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "login_lockouts_organization_id_email_key" ON "login_lockouts"("organization_id", "email");
