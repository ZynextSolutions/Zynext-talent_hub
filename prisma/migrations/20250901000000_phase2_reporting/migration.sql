-- Phase 2: login events, scheduled reports, certificate expiry

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'CERT_EXPIRING';
ALTER TYPE "NotificationKind" ADD VALUE 'CERT_EXPIRED';

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('CSV', 'PDF');
CREATE TYPE "ReportScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "certificates" ADD COLUMN "expires_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "login_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scheduled_reports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "report_type" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "format" "ReportFormat" NOT NULL DEFAULT 'CSV',
    "frequency" "ReportScheduleFrequency" NOT NULL,
    "recipients" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "report_deliveries" (
    "id" TEXT NOT NULL,
    "scheduled_report_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sent_on_date" DATE NOT NULL,
    "file_path" TEXT,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_events_organization_id_created_at_idx" ON "login_events"("organization_id", "created_at");
CREATE INDEX "login_events_organization_id_user_id_created_at_idx" ON "login_events"("organization_id", "user_id", "created_at");
CREATE INDEX "scheduled_reports_organization_id_enabled_next_run_at_idx" ON "scheduled_reports"("organization_id", "enabled", "next_run_at");
CREATE INDEX "report_deliveries_organization_id_sent_on_date_idx" ON "report_deliveries"("organization_id", "sent_on_date");
CREATE UNIQUE INDEX "report_deliveries_scheduled_report_id_sent_on_date_key" ON "report_deliveries"("scheduled_report_id", "sent_on_date");
CREATE INDEX "certificates_organization_id_expires_at_idx" ON "certificates"("organization_id", "expires_at");

-- AddForeignKey
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_scheduled_report_id_fkey" FOREIGN KEY ("scheduled_report_id") REFERENCES "scheduled_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill certificate expiry from assignment recertify settings
UPDATE "certificates" c
SET "expires_at" = c."issued_at" + (ca."recertify_every_days" || ' days')::interval
FROM "enrollments" e
JOIN "course_assignments" ca ON ca."id" = e."assignment_id"
WHERE c."enrollment_id" = e."id"
  AND ca."recertify_every_days" IS NOT NULL
  AND c."expires_at" IS NULL;
