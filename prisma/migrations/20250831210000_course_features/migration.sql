-- Course catalog windows, completion rules, lesson required flag

CREATE TYPE "CompletionMode" AS ENUM ('ALL_LESSONS', 'REQUIRED_LESSONS', 'PERCENTAGE');

ALTER TABLE "courses" ADD COLUMN "available_from" TIMESTAMP(3);
ALTER TABLE "courses" ADD COLUMN "available_until" TIMESTAMP(3);
ALTER TABLE "courses" ADD COLUMN "completion_mode" "CompletionMode" NOT NULL DEFAULT 'ALL_LESSONS';
ALTER TABLE "courses" ADD COLUMN "completion_percent" INTEGER;

ALTER TABLE "lessons" ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT true;
