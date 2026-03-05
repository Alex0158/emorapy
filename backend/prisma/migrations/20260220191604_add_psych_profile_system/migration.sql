-- CreateEnum
CREATE TYPE "PsychDomain" AS ENUM ('attachment', 'family_origin', 'life_events', 'belief_values', 'cultural_background', 'education_cognition', 'personality', 'relationship_history');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('in_progress', 'processing', 'completed', 'processing_failed', 'abandoned');

-- CreateEnum
CREATE TYPE "InterviewTrigger" AS ENUM ('organic', 'pre_case', 'post_judgment', 'onboarding');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('trait', 'pattern', 'belief', 'trigger', 'strength', 'risk', 'cultural', 'developmental');

-- DropIndex
DROP INDEX "email_verifications_email_idx";

-- DropIndex
DROP INDEX "email_verifications_type_idx";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "psych_consent_at" TIMESTAMP(3),
ADD COLUMN     "psych_consent_given" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "interview_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'in_progress',
    "trigger" "InterviewTrigger" NOT NULL DEFAULT 'organic',
    "ai_model_used" VARCHAR(50),
    "total_user_words" INTEGER NOT NULL DEFAULT 0,
    "total_ai_words" INTEGER NOT NULL DEFAULT 0,
    "domains_touched" "PsychDomain"[] DEFAULT ARRAY[]::"PsychDomain"[],
    "feedback_card" TEXT,
    "pipeline_step" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_turns" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "turn_order" INTEGER NOT NULL,
    "ai_message" TEXT NOT NULL,
    "ai_intent" TEXT,
    "ai_target_domains" "PsychDomain"[] DEFAULT ARRAY[]::"PsychDomain"[],
    "user_response" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "safety_flag" BOOLEAN NOT NULL DEFAULT false,
    "safety_detail" TEXT,
    "response_word_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_narratives" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "domain" "PsychDomain" NOT NULL,
    "raw_narrative" TEXT NOT NULL,
    "ai_summary" TEXT,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "completeness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source_sessions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_latest" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_narratives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_insights" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "narrative_id" TEXT,
    "domain" "PsychDomain" NOT NULL,
    "insight_type" "InsightType" NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "evidence" TEXT,
    "clinical_note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_snapshots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "snapshot_data" JSONB NOT NULL,
    "richness_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interview_sessions_user_id_status_idx" ON "interview_sessions"("user_id", "status");

-- CreateIndex
CREATE INDEX "interview_sessions_user_id_created_at_idx" ON "interview_sessions"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "interview_turns_session_id_turn_order_key" ON "interview_turns"("session_id", "turn_order");

-- CreateIndex
CREATE INDEX "profile_narratives_user_id_domain_is_latest_idx" ON "profile_narratives"("user_id", "domain", "is_latest");

-- CreateIndex
CREATE INDEX "profile_insights_user_id_domain_is_active_idx" ON "profile_insights"("user_id", "domain", "is_active");

-- CreateIndex
CREATE INDEX "profile_insights_user_id_key_is_active_idx" ON "profile_insights"("user_id", "key", "is_active");

-- CreateIndex
CREATE INDEX "profile_snapshots_user_id_idx" ON "profile_snapshots"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "profile_snapshots_case_id_user_id_key" ON "profile_snapshots"("case_id", "user_id");

-- CreateIndex
CREATE INDEX "email_verifications_email_type_used_idx" ON "email_verifications"("email", "type", "used");

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_turns" ADD CONSTRAINT "interview_turns_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_narratives" ADD CONSTRAINT "profile_narratives_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_insights" ADD CONSTRAINT "profile_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_insights" ADD CONSTRAINT "profile_insights_narrative_id_fkey" FOREIGN KEY ("narrative_id") REFERENCES "profile_narratives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_snapshots" ADD CONSTRAINT "profile_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_snapshots" ADD CONSTRAINT "profile_snapshots_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique indexes (cannot be expressed in Prisma schema, must be raw SQL)

-- 每用戶僅允許 1 個 in_progress 訪談
CREATE UNIQUE INDEX "ux_interview_sessions_user_in_progress"
  ON "interview_sessions"("user_id") WHERE status = 'in_progress';

-- 每用戶每域僅允許 1 個 is_latest=true 的敘事
CREATE UNIQUE INDEX "ux_profile_narratives_user_domain_latest"
  ON "profile_narratives"("user_id", "domain") WHERE is_latest = true;

-- CHECK constraints
ALTER TABLE "profile_narratives" ADD CONSTRAINT "chk_narrative_completeness"
  CHECK (completeness >= 0 AND completeness <= 1);
ALTER TABLE "profile_insights" ADD CONSTRAINT "chk_insight_confidence"
  CHECK (confidence >= 0 AND confidence <= 1);
ALTER TABLE "profile_snapshots" ADD CONSTRAINT "chk_snapshot_richness"
  CHECK (richness_score >= 0 AND richness_score <= 1);
