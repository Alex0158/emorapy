-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other', 'private');

-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('single', 'dating', 'married');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('zh', 'en');

-- CreateEnum
CREATE TYPE "Privacy" AS ENUM ('public', 'partner_only', 'private');

-- CreateEnum
CREATE TYPE "PairingStatus" AS ENUM ('pending', 'active', 'cancelled', 'temp');

-- CreateEnum
CREATE TYPE "PairingType" AS ENUM ('normal', 'quick');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('draft', 'submitted', 'in_progress', 'judgment_failed', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "CaseMode" AS ENUM ('remote', 'collaborative', 'quick');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('image', 'video', 'doc');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('activity', 'communication', 'intimacy', 'gift', 'service');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "ExecutionAction" AS ENUM ('confirm', 'checkin', 'complete', 'skip');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('pending', 'in_progress', 'completed', 'skipped', 'failed');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('register', 'reset_password', 'verify_email');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('article', 'case_sample', 'quiz', 'tip');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'push');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nickname" TEXT,
    "avatar_url" TEXT,
    "avatar_mime" TEXT,
    "gender" "Gender",
    "age" INTEGER,
    "relationship_status" "RelationshipStatus" NOT NULL DEFAULT 'single',
    "language" "Language" NOT NULL DEFAULT 'zh',
    "timezone" TEXT,
    "notification_enabled" BOOLEAN NOT NULL DEFAULT true,
    "privacy_level" "Privacy" NOT NULL DEFAULT 'private',
    "last_login_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "education_level" TEXT,
    "major_field" TEXT,
    "university" TEXT,
    "ethnicity" TEXT,
    "cultural_identity" TEXT[],
    "upbringing_environment" TEXT,
    "religion" TEXT,
    "religious_practice_level" TEXT,
    "family_structure" TEXT,
    "parents_relationship" TEXT,
    "family_economic_status" TEXT,
    "mbti_type" TEXT,
    "big_five_personality" JSONB,
    "communication_style" TEXT,
    "occupation" TEXT,
    "interests" TEXT[],
    "core_values" TEXT[],
    "profile_visibility" "Privacy" NOT NULL DEFAULT 'private',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pairings" (
    "id" TEXT NOT NULL,
    "user1_id" TEXT,
    "user2_id" TEXT,
    "invite_code" VARCHAR(6),
    "status" "PairingStatus" NOT NULL DEFAULT 'pending',
    "pairing_type" "PairingType" NOT NULL DEFAULT 'normal',
    "session_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "pairings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_profiles" (
    "id" TEXT NOT NULL,
    "pairing_id" TEXT NOT NULL,
    "relationship_duration_days" INTEGER,
    "relationship_stage" TEXT,
    "milestones" JSONB,
    "user1_location" TEXT,
    "user2_location" TEXT,
    "is_long_distance" BOOLEAN NOT NULL DEFAULT false,
    "distance_km" INTEGER,
    "meeting_frequency" TEXT,
    "user1_bottom_lines" TEXT[],
    "user2_bottom_lines" TEXT[],
    "common_bottom_lines" TEXT[],
    "historical_red_flags" JSONB,
    "user1_preferences" JSONB,
    "user2_preferences" JSONB,
    "common_preferences" JSONB,
    "dislikes" JSONB,
    "communication_frequency" TEXT,
    "preferred_communication_methods" TEXT[],
    "conflict_communication_style" TEXT,
    "relationship_strengths" TEXT[],
    "relationship_challenges" TEXT[],
    "historical_case_types" JSONB,
    "historical_responsibility_trends" JSONB,
    "reconciliation_plan_execution_rate" DOUBLE PRECISION,
    "relationship_improvement_trend" TEXT,
    "completion_percentage" INTEGER NOT NULL DEFAULT 0,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationship_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "pairing_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "sub_type" VARCHAR(50),
    "plaintiff_id" TEXT,
    "defendant_id" TEXT,
    "plaintiff_statement" TEXT NOT NULL,
    "defendant_statement" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'draft',
    "judgment_failure_reason" VARCHAR(500),
    "mode" "CaseMode" NOT NULL DEFAULT 'remote',
    "session_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidences" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "user_id" TEXT,
    "file_url" VARCHAR(500) NOT NULL,
    "mime_type" TEXT,
    "file_type" "FileType" NOT NULL,
    "file_size" INTEGER NOT NULL,
    "checksum" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "judgments" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "judgment_content" TEXT NOT NULL,
    "summary" TEXT,
    "plaintiff_ratio" DOUBLE PRECISION NOT NULL,
    "defendant_ratio" DOUBLE PRECISION NOT NULL,
    "ai_model" VARCHAR(50) NOT NULL DEFAULT 'gpt-3.5-turbo',
    "prompt_version" VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    "user1_acceptance" BOOLEAN,
    "user2_acceptance" BOOLEAN,
    "user1_rating" INTEGER,
    "user2_rating" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "judgments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_plans" (
    "id" TEXT NOT NULL,
    "judgment_id" TEXT NOT NULL,
    "plan_content" TEXT NOT NULL,
    "plan_type" "PlanType" NOT NULL,
    "difficulty_level" "Difficulty" NOT NULL,
    "estimated_duration" INTEGER,
    "time_cost" INTEGER NOT NULL,
    "money_cost" INTEGER NOT NULL,
    "emotion_cost" INTEGER NOT NULL,
    "skill_requirement" INTEGER NOT NULL,
    "user1_selected" BOOLEAN NOT NULL DEFAULT false,
    "user2_selected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_records" (
    "id" TEXT NOT NULL,
    "reconciliation_plan_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "ExecutionAction" NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "photos_urls" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "execution_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quick_sessions" (
    "id" VARCHAR(100) NOT NULL,
    "pairing_id" TEXT,
    "case_id" TEXT,
    "session_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quick_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "type" "VerificationType" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "content_type" "ContentType" NOT NULL,
    "tags" TEXT[],
    "language" "Language" NOT NULL DEFAULT 'en',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_content_links" (
    "case_id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "relation" VARCHAR(30) NOT NULL DEFAULT 'recommend',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_content_links_pkey" PRIMARY KEY ("case_id","content_id","relation")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "template_code" VARCHAR(50) NOT NULL,
    "payload" JSONB,
    "dedup_key" VARCHAR(100),
    "sent_at" TIMESTAMP(3),
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" TEXT,
    "actor_type" VARCHAR(20),
    "entity_type" VARCHAR(50),
    "entity_id" TEXT,
    "action" VARCHAR(50),
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "users_email_verified_idx" ON "users"("email_verified");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "pairings_invite_code_key" ON "pairings"("invite_code");

-- CreateIndex
CREATE INDEX "pairings_user1_id_idx" ON "pairings"("user1_id");

-- CreateIndex
CREATE INDEX "pairings_user2_id_idx" ON "pairings"("user2_id");

-- CreateIndex
CREATE INDEX "pairings_status_idx" ON "pairings"("status");

-- CreateIndex
CREATE INDEX "pairings_expires_at_idx" ON "pairings"("expires_at");

-- CreateIndex
CREATE INDEX "pairings_session_id_idx" ON "pairings"("session_id");

-- CreateIndex
CREATE INDEX "pairings_pairing_type_idx" ON "pairings"("pairing_type");

-- CreateIndex
CREATE UNIQUE INDEX "relationship_profiles_pairing_id_key" ON "relationship_profiles"("pairing_id");

-- CreateIndex
CREATE INDEX "cases_pairing_id_idx" ON "cases"("pairing_id");

-- CreateIndex
CREATE INDEX "cases_plaintiff_id_idx" ON "cases"("plaintiff_id");

-- CreateIndex
CREATE INDEX "cases_defendant_id_idx" ON "cases"("defendant_id");

-- CreateIndex
CREATE INDEX "cases_status_idx" ON "cases"("status");

-- CreateIndex
CREATE INDEX "cases_type_idx" ON "cases"("type");

-- CreateIndex
CREATE INDEX "cases_created_at_idx" ON "cases"("created_at");

-- CreateIndex
CREATE INDEX "cases_submitted_at_idx" ON "cases"("submitted_at");

-- CreateIndex
CREATE INDEX "cases_mode_idx" ON "cases"("mode");

-- CreateIndex
CREATE INDEX "evidences_case_id_idx" ON "evidences"("case_id");

-- CreateIndex
CREATE INDEX "evidences_user_id_idx" ON "evidences"("user_id");

-- CreateIndex
CREATE INDEX "evidences_file_type_idx" ON "evidences"("file_type");

-- CreateIndex
CREATE UNIQUE INDEX "judgments_case_id_key" ON "judgments"("case_id");

-- CreateIndex
CREATE INDEX "judgments_case_id_idx" ON "judgments"("case_id");

-- CreateIndex
CREATE INDEX "judgments_created_at_idx" ON "judgments"("created_at");

-- CreateIndex
CREATE INDEX "judgments_user1_acceptance_idx" ON "judgments"("user1_acceptance");

-- CreateIndex
CREATE INDEX "judgments_user2_acceptance_idx" ON "judgments"("user2_acceptance");

-- CreateIndex
CREATE INDEX "reconciliation_plans_judgment_id_idx" ON "reconciliation_plans"("judgment_id");

-- CreateIndex
CREATE INDEX "reconciliation_plans_difficulty_level_idx" ON "reconciliation_plans"("difficulty_level");

-- CreateIndex
CREATE INDEX "reconciliation_plans_plan_type_idx" ON "reconciliation_plans"("plan_type");

-- CreateIndex
CREATE INDEX "execution_records_reconciliation_plan_id_idx" ON "execution_records"("reconciliation_plan_id");

-- CreateIndex
CREATE INDEX "execution_records_user_id_idx" ON "execution_records"("user_id");

-- CreateIndex
CREATE INDEX "execution_records_status_idx" ON "execution_records"("status");

-- CreateIndex
CREATE INDEX "execution_records_action_idx" ON "execution_records"("action");

-- CreateIndex
CREATE INDEX "quick_sessions_expires_at_idx" ON "quick_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "quick_sessions_pairing_id_idx" ON "quick_sessions"("pairing_id");

-- CreateIndex
CREATE INDEX "quick_sessions_case_id_idx" ON "quick_sessions"("case_id");

-- CreateIndex
CREATE INDEX "email_verifications_email_idx" ON "email_verifications"("email");

-- CreateIndex
CREATE INDEX "email_verifications_code_idx" ON "email_verifications"("code");

-- CreateIndex
CREATE INDEX "email_verifications_expires_at_idx" ON "email_verifications"("expires_at");

-- CreateIndex
CREATE INDEX "email_verifications_type_idx" ON "email_verifications"("type");

-- CreateIndex
CREATE INDEX "content_items_content_type_idx" ON "content_items"("content_type");

-- CreateIndex
CREATE INDEX "content_items_is_active_idx" ON "content_items"("is_active");

-- CreateIndex
CREATE INDEX "case_content_links_relation_idx" ON "case_content_links"("relation");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedup_key_template_code_key" ON "notifications"("dedup_key", "template_code");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_profiles" ADD CONSTRAINT "relationship_profiles_pairing_id_fkey" FOREIGN KEY ("pairing_id") REFERENCES "pairings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_defendant_id_fkey" FOREIGN KEY ("defendant_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_pairing_id_fkey" FOREIGN KEY ("pairing_id") REFERENCES "pairings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_plaintiff_id_fkey" FOREIGN KEY ("plaintiff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "judgments" ADD CONSTRAINT "judgments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_plans" ADD CONSTRAINT "reconciliation_plans_judgment_id_fkey" FOREIGN KEY ("judgment_id") REFERENCES "judgments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_records" ADD CONSTRAINT "execution_records_reconciliation_plan_id_fkey" FOREIGN KEY ("reconciliation_plan_id") REFERENCES "reconciliation_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_records" ADD CONSTRAINT "execution_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_sessions" ADD CONSTRAINT "quick_sessions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_sessions" ADD CONSTRAINT "quick_sessions_pairing_id_fkey" FOREIGN KEY ("pairing_id") REFERENCES "pairings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_content_links" ADD CONSTRAINT "case_content_links_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_content_links" ADD CONSTRAINT "case_content_links_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
