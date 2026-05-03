-- Add cross-product safety assessment and active relationship risk state storage.
-- These tables are additive and are not read by existing request paths until follow-up integration.

DO $$
BEGIN
  CREATE TYPE "SafetyRiskLevel" AS ENUM (
    'standard',
    'sensitive',
    'high_risk_relationship',
    'imminent_crisis',
    'minor_or_suspected_minor',
    'illegal_or_nonconsensual_content'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SafetyAssessmentSubjectType" AS ENUM (
    'user',
    'pairing',
    'case',
    'chat_room',
    'repair_track',
    'evidence'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SafetyAssessmentSource" AS ENUM (
    'evidence_assertion',
    'formal_case_assertion',
    'chat_judgment_policy',
    'judgment_route',
    'repair_policy',
    'system_audit',
    'admin_review'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS "safety_assessments" (
  "id" TEXT NOT NULL,
  "subject_type" "SafetyAssessmentSubjectType" NOT NULL,
  "subject_id" TEXT NOT NULL,
  "source" "SafetyAssessmentSource" NOT NULL,
  "risk_level" "SafetyRiskLevel" NOT NULL DEFAULT 'standard',
  "judgment_route" VARCHAR(50),
  "can_invite_partner" BOOLEAN NOT NULL DEFAULT true,
  "can_use_co_repair" BOOLEAN NOT NULL DEFAULT true,
  "can_notify_partner" BOOLEAN NOT NULL DEFAULT true,
  "can_show_responsibility_ratio" BOOLEAN NOT NULL DEFAULT true,
  "force_solo_repair" BOOLEAN NOT NULL DEFAULT false,
  "reasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "assessed_by_user_id" TEXT,
  "expires_at" TIMESTAMP(3),
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "safety_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "relationship_risk_states" (
  "id" TEXT NOT NULL,
  "scope_type" "SafetyAssessmentSubjectType" NOT NULL,
  "scope_id" TEXT NOT NULL,
  "current_risk_level" "SafetyRiskLevel" NOT NULL DEFAULT 'standard',
  "judgment_route" VARCHAR(50),
  "can_invite_partner" BOOLEAN NOT NULL DEFAULT true,
  "can_use_co_repair" BOOLEAN NOT NULL DEFAULT true,
  "can_notify_partner" BOOLEAN NOT NULL DEFAULT true,
  "can_show_responsibility_ratio" BOOLEAN NOT NULL DEFAULT true,
  "force_solo_repair" BOOLEAN NOT NULL DEFAULT false,
  "source_assessment_id" TEXT,
  "reasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "relationship_risk_states_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "safety_assessments_subject_created_idx"
  ON "safety_assessments" ("subject_type", "subject_id", "created_at");
CREATE INDEX IF NOT EXISTS "safety_assessments_subject_resolved_idx"
  ON "safety_assessments" ("subject_type", "subject_id", "resolved_at");
CREATE INDEX IF NOT EXISTS "safety_assessments_risk_resolved_idx"
  ON "safety_assessments" ("risk_level", "resolved_at");
CREATE INDEX IF NOT EXISTS "safety_assessments_source_created_idx"
  ON "safety_assessments" ("source", "created_at");
CREATE INDEX IF NOT EXISTS "safety_assessments_assessed_by_user_idx"
  ON "safety_assessments" ("assessed_by_user_id");

CREATE INDEX IF NOT EXISTS "relationship_risk_states_scope_idx"
  ON "relationship_risk_states" ("scope_type", "scope_id");
CREATE INDEX IF NOT EXISTS "relationship_risk_states_risk_active_idx"
  ON "relationship_risk_states" ("current_risk_level", "is_active");
CREATE INDEX IF NOT EXISTS "relationship_risk_states_source_assessment_idx"
  ON "relationship_risk_states" ("source_assessment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "relationship_risk_states_one_active_scope_idx"
  ON "relationship_risk_states" ("scope_type", "scope_id")
  WHERE "is_active" = true;
