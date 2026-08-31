-- Dashboard enrollment lookups by course within an org
CREATE INDEX IF NOT EXISTS "enrollments_organization_id_course_id_idx"
  ON "enrollments"("organization_id", "course_id");
