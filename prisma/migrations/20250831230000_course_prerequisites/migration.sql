-- Course and lesson prerequisites
ALTER TABLE "lessons" ADD COLUMN "prerequisite_lesson_id" TEXT;

CREATE TABLE "course_prerequisites" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "prerequisite_course_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_prerequisites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "course_prerequisites_course_id_prerequisite_course_id_key" ON "course_prerequisites"("course_id", "prerequisite_course_id");
CREATE INDEX "course_prerequisites_organization_id_course_id_idx" ON "course_prerequisites"("organization_id", "course_id");
CREATE INDEX "lessons_prerequisite_lesson_id_idx" ON "lessons"("prerequisite_lesson_id");

ALTER TABLE "lessons" ADD CONSTRAINT "lessons_prerequisite_lesson_id_fkey" FOREIGN KEY ("prerequisite_lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_prerequisite_course_id_fkey" FOREIGN KEY ("prerequisite_course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
