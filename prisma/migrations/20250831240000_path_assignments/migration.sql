-- Learning path assignments (bulk enroll targets)
CREATE TABLE "path_assignments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "path_id" TEXT NOT NULL,
    "target_type" "AssignmentTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "path_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "path_assignments_organization_id_path_id_target_type_target_id_key" ON "path_assignments"("organization_id", "path_id", "target_type", "target_id");
CREATE INDEX "path_assignments_organization_id_path_id_idx" ON "path_assignments"("organization_id", "path_id");

ALTER TABLE "path_assignments" ADD CONSTRAINT "path_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "path_assignments" ADD CONSTRAINT "path_assignments_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;
