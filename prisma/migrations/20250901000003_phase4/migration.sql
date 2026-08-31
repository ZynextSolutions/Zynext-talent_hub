-- Phase 4: learning time, ROI costs, analytics snapshots

ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "cost_cents" INTEGER;

ALTER TABLE "progress" ADD COLUMN IF NOT EXISTS "watched_seconds" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "analytics_daily_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_daily_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "analytics_daily_snapshots_organization_id_date_key"
  ON "analytics_daily_snapshots"("organization_id", "date");

CREATE INDEX IF NOT EXISTS "analytics_daily_snapshots_organization_id_date_idx"
  ON "analytics_daily_snapshots"("organization_id", "date");

ALTER TABLE "analytics_daily_snapshots"
  ADD CONSTRAINT "analytics_daily_snapshots_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
