-- SCORM MVP: lesson kind, course version, enrollment CMI fields

ALTER TYPE "LessonKind" ADD VALUE IF NOT EXISTS 'SCORM';

ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "scorm_version" TEXT;

ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "scorm_lesson_status" TEXT;
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "scorm_score_raw" DOUBLE PRECISION;
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "scorm_suspend_data" TEXT;
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "scorm_location" TEXT;
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "scorm_session_time" TEXT;
