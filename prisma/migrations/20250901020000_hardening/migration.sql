-- Progress visit timestamp for completion integrity
ALTER TABLE "progress" ADD COLUMN "opened_at" TIMESTAMP(3);

-- Platform admin MFA
ALTER TABLE "platform_admins" ADD COLUMN "mfa_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "platform_admins" ADD COLUMN "mfa_secret" TEXT;
ALTER TABLE "platform_admins" ADD COLUMN "mfa_secret_pending" TEXT;

-- Platform MFA token binding
ALTER TABLE "one_time_tokens" ADD COLUMN "platform_admin_id" TEXT;
ALTER TABLE "one_time_tokens" ADD CONSTRAINT "one_time_tokens_platform_admin_id_fkey" FOREIGN KEY ("platform_admin_id") REFERENCES "platform_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "assessment_attempts_assessment_id_user_id_attempt_number_key"
  ON "assessment_attempts"("assessment_id", "user_id", "attempt_number");
