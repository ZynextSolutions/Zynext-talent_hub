-- Phase 3: skills, xAPI, BI integrations, compliance packages

CREATE TYPE "XapiStatementStatus" AS ENUM ('STORED', 'FAILED');
CREATE TYPE "CompliancePackageStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "course_skills" (
    "course_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "course_skills_pkey" PRIMARY KEY ("course_id","skill_id")
);

CREATE TABLE "role_skills" (
    "role_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "required_level" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "role_skills_pkey" PRIMARY KEY ("role_id","skill_id")
);

CREATE TABLE "user_skill_demonstrations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "source_course_id" TEXT,
    "demonstrated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_skill_demonstrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "xapi_statements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "verb" TEXT NOT NULL,
    "activity_id" TEXT,
    "statement" JSONB NOT NULL,
    "status" "XapiStatementStatus" NOT NULL DEFAULT 'STORED',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xapi_statements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_delivery_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compliance_packages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT,
    "status" "CompliancePackageStatus" NOT NULL DEFAULT 'PENDING',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "manifest" JSONB NOT NULL DEFAULT '{}',
    "file_path" TEXT,
    "error_message" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_packages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skills_organization_id_name_key" ON "skills"("organization_id", "name");
CREATE INDEX "skills_organization_id_idx" ON "skills"("organization_id");
CREATE UNIQUE INDEX "user_skill_demonstrations_user_id_skill_id_key" ON "user_skill_demonstrations"("user_id", "skill_id");
CREATE INDEX "user_skill_demonstrations_organization_id_skill_id_idx" ON "user_skill_demonstrations"("organization_id", "skill_id");
CREATE INDEX "xapi_statements_organization_id_created_at_idx" ON "xapi_statements"("organization_id", "created_at");
CREATE INDEX "xapi_statements_organization_id_verb_idx" ON "xapi_statements"("organization_id", "verb");
CREATE INDEX "api_keys_organization_id_idx" ON "api_keys"("organization_id");
CREATE INDEX "api_keys_key_prefix_idx" ON "api_keys"("key_prefix");
CREATE INDEX "webhooks_organization_id_idx" ON "webhooks"("organization_id");
CREATE INDEX "compliance_packages_organization_id_created_at_idx" ON "compliance_packages"("organization_id", "created_at");

ALTER TABLE "skills" ADD CONSTRAINT "skills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_skills" ADD CONSTRAINT "course_skills_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_skills" ADD CONSTRAINT "course_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_skills" ADD CONSTRAINT "role_skills_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_skills" ADD CONSTRAINT "role_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_skill_demonstrations" ADD CONSTRAINT "user_skill_demonstrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_skill_demonstrations" ADD CONSTRAINT "user_skill_demonstrations_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "xapi_statements" ADD CONSTRAINT "xapi_statements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compliance_packages" ADD CONSTRAINT "compliance_packages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
