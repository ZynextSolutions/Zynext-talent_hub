-- Tier B + C: compliance, learning paths, question banks, advanced assessments

CREATE TYPE "AssessmentKind" AS ENUM ('PRE', 'FINAL');
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'TRUE_FALSE', 'MULTI_SELECT', 'SHORT_ANSWER');
CREATE TYPE "AttemptGradingStatus" AS ENUM ('AUTO_GRADED', 'PENDING_REVIEW', 'GRADED', 'EXPIRED');
CREATE TYPE "PathStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "PathEnrollmentStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

ALTER TYPE "EnrollmentSource" ADD VALUE IF NOT EXISTS 'RECERTIFY';
ALTER TYPE "EnrollmentSource" ADD VALUE IF NOT EXISTS 'PATH';

ALTER TABLE "course_assignments"
  ADD COLUMN IF NOT EXISTS "due_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "recertify_every_days" INTEGER,
  ADD COLUMN IF NOT EXISTS "reminder_days_before" INTEGER DEFAULT 7;

ALTER TABLE "enrollments"
  ADD COLUMN IF NOT EXISTS "path_enrollment_id" TEXT,
  ADD COLUMN IF NOT EXISTS "due_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "enrollments_organization_id_due_at_idx" ON "enrollments"("organization_id", "due_at");

ALTER TABLE "assessments"
  ADD COLUMN IF NOT EXISTS "kind" "AssessmentKind" NOT NULL DEFAULT 'FINAL',
  ADD COLUMN IF NOT EXISTS "time_limit_seconds" INTEGER,
  ADD COLUMN IF NOT EXISTS "bank_id" TEXT,
  ADD COLUMN IF NOT EXISTS "draw_count" INTEGER;

ALTER TABLE "assessment_questions"
  ADD COLUMN IF NOT EXISTS "bank_question_id" TEXT,
  ADD COLUMN IF NOT EXISTS "type" "QuestionType" NOT NULL DEFAULT 'MCQ',
  ADD COLUMN IF NOT EXISTS "correct_option_ids" JSONB;
ALTER TABLE "assessment_questions" ALTER COLUMN "correct_option_id" DROP NOT NULL;

ALTER TABLE "assessment_attempts"
  ADD COLUMN IF NOT EXISTS "question_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "grading_status" "AttemptGradingStatus" NOT NULL DEFAULT 'AUTO_GRADED',
  ADD COLUMN IF NOT EXISTS "graded_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "graded_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "instructor_feedback" TEXT,
  ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);
ALTER TABLE "assessment_attempts" ALTER COLUMN "score" DROP NOT NULL;
ALTER TABLE "assessment_attempts" ALTER COLUMN "answers" SET DEFAULT '[]';

CREATE TABLE IF NOT EXISTS "question_banks" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "question_banks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bank_questions" (
  "id" TEXT NOT NULL,
  "bank_id" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "type" "QuestionType" NOT NULL DEFAULT 'MCQ',
  "options" JSONB NOT NULL DEFAULT '[]',
  "correct_option_id" TEXT,
  "correct_option_ids" JSONB,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "learning_paths" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "status" "PathStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "path_courses" (
  "id" TEXT NOT NULL,
  "path_id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "order_index" INTEGER NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "path_courses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "path_enrollments" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "path_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "status" "PathEnrollmentStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "progress_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "path_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "path_certificates" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "path_enrollment_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "path_id" TEXT NOT NULL,
  "certificate_number" TEXT NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "path_certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "path_courses_path_id_course_id_key" ON "path_courses"("path_id", "course_id");
CREATE UNIQUE INDEX IF NOT EXISTS "path_enrollments_organization_id_path_id_user_id_key" ON "path_enrollments"("organization_id", "path_id", "user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "path_certificates_path_enrollment_id_key" ON "path_certificates"("path_enrollment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "path_certificates_certificate_number_key" ON "path_certificates"("certificate_number");

ALTER TABLE "assessments" ADD CONSTRAINT "assessments_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "question_banks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_bank_question_id_fkey" FOREIGN KEY ("bank_question_id") REFERENCES "bank_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_graded_by_user_id_fkey" FOREIGN KEY ("graded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_path_enrollment_id_fkey" FOREIGN KEY ("path_enrollment_id") REFERENCES "path_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "question_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "path_courses" ADD CONSTRAINT "path_courses_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "path_courses" ADD CONSTRAINT "path_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "path_enrollments" ADD CONSTRAINT "path_enrollments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "path_enrollments" ADD CONSTRAINT "path_enrollments_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "path_enrollments" ADD CONSTRAINT "path_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "path_certificates" ADD CONSTRAINT "path_certificates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "path_certificates" ADD CONSTRAINT "path_certificates_path_enrollment_id_fkey" FOREIGN KEY ("path_enrollment_id") REFERENCES "path_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "path_certificates" ADD CONSTRAINT "path_certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "path_certificates" ADD CONSTRAINT "path_certificates_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;
