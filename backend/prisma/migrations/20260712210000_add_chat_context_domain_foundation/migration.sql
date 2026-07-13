-- Expand-only foundation for audience-scoped chat context.
-- This migration intentionally does not create channels for existing rooms,
-- backfill chat_messages.channel_id, or reinterpret legacy visibility_scope.

-- CreateEnum
CREATE TYPE "ChatChannelKind" AS ENUM ('shared', 'private');

-- CreateEnum
CREATE TYPE "PrivateContextUseMode" AS ENUM ('private_only', 'shared_process_controls');

-- Existing participants remain private-only until the owner explicitly opts in.
ALTER TABLE "chat_participants"
ADD COLUMN "private_context_use_mode" "PrivateContextUseMode" NOT NULL DEFAULT 'private_only';

-- New rooms no longer imply that pre-join material is shareable.
ALTER TABLE "chat_rooms"
ALTER COLUMN "history_visibility_mode" SET DEFAULT 'share_from_join_time';

-- CreateEnum
CREATE TYPE "ContextCapsuleStatus" AS ENUM (
    'draft',
    'approved',
    'revoked',
    'expired',
    'discarded',
    'legacy_review_required'
);

-- CreateEnum
CREATE TYPE "ContextSensitivityClass" AS ENUM (
    'standard',
    'sensitive',
    'highly_sensitive',
    'safety_restricted'
);

-- CreateEnum
CREATE TYPE "ContextPurpose" AS ENUM (
    'private_support',
    'shared_mediation',
    'formal_analysis_evidence',
    'formal_analysis_delivery',
    'future_private_support',
    'future_joint_support',
    'solo_repair',
    'joint_repair',
    'safety_routing'
);

-- CreateEnum
CREATE TYPE "ContextAudience" AS ENUM (
    'private_owner',
    'room_participants',
    'analysis_participants',
    'pairing_participants',
    'safety_system'
);

-- CreateEnum
CREATE TYPE "ContextTargetType" AS ENUM (
    'user',
    'chat_room',
    'case',
    'pairing',
    'analysis_request',
    'repair_track'
);

-- CreateEnum
CREATE TYPE "ChatAnalysisRequestStatus" AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'submitted',
    'processing',
    'completed',
    'cancelled',
    'expired'
);

-- CreateEnum
CREATE TYPE "ChatAnalysisApprovalDecision" AS ENUM ('approved', 'declined');

-- CreateEnum
CREATE TYPE "ContextUseDecision" AS ENUM ('allowed', 'denied');

-- CreateTable
CREATE TABLE "chat_channels" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "kind" "ChatChannelKind" NOT NULL,
    "owner_participant_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_channels_owner_matches_kind_check" CHECK (
        ("kind" = 'shared' AND "owner_participant_id" IS NULL)
        OR
        ("kind" = 'private' AND "owner_participant_id" IS NOT NULL)
    )
);

-- AlterTable: channel_id remains nullable during expand/dual-read. Historical
-- rows fail closed for AI reuse until the audited backfill classifies them.
ALTER TABLE "chat_messages"
ADD COLUMN "channel_id" TEXT,
ADD COLUMN "ai_context_eligible" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "context_capsules" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "owner_participant_id" TEXT NOT NULL,
    "source_channel_id" TEXT NOT NULL,
    "lineage_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "summary" TEXT NOT NULL,
    "source_refs" JSONB NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "policy_version" VARCHAR(50) NOT NULL,
    "sensitivity_class" "ContextSensitivityClass" NOT NULL DEFAULT 'sensitive',
    "status" "ContextCapsuleStatus" NOT NULL DEFAULT 'draft',
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "context_capsules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "context_capsules_version_positive_check" CHECK ("version" > 0),
    CONSTRAINT "context_capsules_summary_not_blank_check" CHECK (length(btrim("summary")) > 0),
    CONSTRAINT "context_capsules_source_refs_array_check" CHECK (jsonb_typeof("source_refs") = 'array'),
    CONSTRAINT "context_capsules_content_hash_check" CHECK ("content_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "context_capsules_policy_version_not_blank_check" CHECK (length(btrim("policy_version")) > 0),
    CONSTRAINT "context_capsules_expiry_after_creation_check" CHECK ("expires_at" IS NULL OR "expires_at" > "created_at"),
    CONSTRAINT "context_capsules_revocation_after_creation_check" CHECK ("revoked_at" IS NULL OR "revoked_at" >= "created_at"),
    CONSTRAINT "context_capsules_revoked_state_check" CHECK (
        ("status" = 'revoked' AND "revoked_at" IS NOT NULL)
        OR
        ("status" <> 'revoked' AND "revoked_at" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "context_authorizations" (
    "id" TEXT NOT NULL,
    "capsule_id" TEXT NOT NULL,
    "subject_participant_id" TEXT NOT NULL,
    "purpose" "ContextPurpose" NOT NULL,
    "audience" "ContextAudience" NOT NULL,
    "target_type" "ContextTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "capsule_content_hash" VARCHAR(64) NOT NULL,
    "policy_version" VARCHAR(50) NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revocation_reason_code" VARCHAR(100),

    CONSTRAINT "context_authorizations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "context_authorizations_target_not_blank_check" CHECK (length(btrim("target_id")) > 0),
    CONSTRAINT "context_authorizations_content_hash_check" CHECK ("capsule_content_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "context_authorizations_policy_version_not_blank_check" CHECK (length(btrim("policy_version")) > 0),
    CONSTRAINT "context_authorizations_expiry_after_grant_check" CHECK ("expires_at" IS NULL OR "expires_at" > "granted_at"),
    CONSTRAINT "context_authorizations_revocation_after_grant_check" CHECK ("revoked_at" IS NULL OR "revoked_at" >= "granted_at"),
    CONSTRAINT "context_authorizations_revocation_reason_check" CHECK (
        ("revoked_at" IS NULL AND "revocation_reason_code" IS NULL)
        OR
        (
            "revoked_at" IS NOT NULL
            AND "revocation_reason_code" IS NOT NULL
            AND length(btrim("revocation_reason_code")) > 0
        )
    )
);

-- CreateTable
CREATE TABLE "chat_analysis_requests" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "requested_by_participant_id" TEXT NOT NULL,
    "status" "ChatAnalysisRequestStatus" NOT NULL DEFAULT 'draft',
    "selection_snapshot" JSONB NOT NULL,
    "selection_hash" VARCHAR(64) NOT NULL,
    "required_participant_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "policy_version" VARCHAR(50) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_analysis_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_analysis_requests_selection_object_check" CHECK (jsonb_typeof("selection_snapshot") = 'object'),
    CONSTRAINT "chat_analysis_requests_selection_hash_check" CHECK ("selection_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "chat_analysis_requests_policy_version_not_blank_check" CHECK (length(btrim("policy_version")) > 0),
    CONSTRAINT "chat_analysis_requests_expiry_after_creation_check" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "chat_analysis_requests_submission_after_creation_check" CHECK ("submitted_at" IS NULL OR "submitted_at" >= "created_at"),
    CONSTRAINT "chat_analysis_requests_cancel_after_creation_check" CHECK ("cancelled_at" IS NULL OR "cancelled_at" >= "created_at")
);

-- CreateTable
CREATE TABLE "chat_analysis_participant_approvals" (
    "id" TEXT NOT NULL,
    "analysis_request_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "decision" "ChatAnalysisApprovalDecision" NOT NULL,
    "selection_hash" VARCHAR(64) NOT NULL,
    "policy_version" VARCHAR(50) NOT NULL,
    "decision_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "chat_analysis_participant_approvals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_analysis_approvals_selection_hash_check" CHECK ("selection_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "chat_analysis_approvals_policy_version_not_blank_check" CHECK (length(btrim("policy_version")) > 0),
    CONSTRAINT "chat_analysis_approvals_expiry_after_decision_check" CHECK ("expires_at" > "decision_at"),
    CONSTRAINT "chat_analysis_approvals_revocation_after_decision_check" CHECK ("revoked_at" IS NULL OR "revoked_at" >= "decision_at"),
    CONSTRAINT "chat_analysis_approvals_only_approved_revoke_check" CHECK ("revoked_at" IS NULL OR "decision" = 'approved')
);

-- CreateTable
CREATE TABLE "context_use_audits" (
    "id" TEXT NOT NULL,
    "room_id" TEXT,
    "actor_participant_id" TEXT,
    "analysis_request_id" TEXT,
    "capsule_id" TEXT,
    "authorization_id" TEXT,
    "purpose" "ContextPurpose" NOT NULL,
    "audience" "ContextAudience" NOT NULL,
    "target_type" "ContextTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "decision" "ContextUseDecision" NOT NULL,
    "reason_code" VARCHAR(100) NOT NULL,
    "source_refs" JSONB NOT NULL,
    "authorization_refs" JSONB NOT NULL,
    "content_hashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "policy_version" VARCHAR(50) NOT NULL,
    "prompt_version" VARCHAR(50),
    "request_correlation_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "context_use_audits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "context_use_audits_target_not_blank_check" CHECK (length(btrim("target_id")) > 0),
    CONSTRAINT "context_use_audits_reason_not_blank_check" CHECK (length(btrim("reason_code")) > 0),
    CONSTRAINT "context_use_audits_source_refs_array_check" CHECK (jsonb_typeof("source_refs") = 'array'),
    CONSTRAINT "context_use_audits_authorization_refs_array_check" CHECK (jsonb_typeof("authorization_refs") = 'array'),
    CONSTRAINT "context_use_audits_policy_version_not_blank_check" CHECK (length(btrim("policy_version")) > 0)
);

-- CreateIndex: PostgreSQL partial unique indexes express the audience invariant
-- that Prisma schema syntax cannot represent.
CREATE UNIQUE INDEX "ux_chat_channels_room_shared"
ON "chat_channels"("room_id")
WHERE "kind" = 'shared' AND "owner_participant_id" IS NULL;

CREATE UNIQUE INDEX "ux_chat_channels_room_private_owner"
ON "chat_channels"("room_id", "owner_participant_id")
WHERE "kind" = 'private' AND "owner_participant_id" IS NOT NULL;

CREATE INDEX "chat_channels_room_id_kind_idx" ON "chat_channels"("room_id", "kind");
CREATE INDEX "chat_channels_owner_participant_id_idx" ON "chat_channels"("owner_participant_id");
CREATE INDEX "chat_messages_channel_id_created_at_idx" ON "chat_messages"("channel_id", "created_at");

CREATE UNIQUE INDEX "ux_context_capsules_lineage_version" ON "context_capsules"("lineage_id", "version");
CREATE UNIQUE INDEX "ux_context_capsules_id_hash_policy" ON "context_capsules"("id", "content_hash", "policy_version");
CREATE INDEX "context_capsules_room_id_owner_participant_id_status_idx" ON "context_capsules"("room_id", "owner_participant_id", "status");
CREATE INDEX "context_capsules_source_channel_id_idx" ON "context_capsules"("source_channel_id");
CREATE INDEX "context_capsules_content_hash_idx" ON "context_capsules"("content_hash");
CREATE INDEX "context_capsules_expires_at_idx" ON "context_capsules"("expires_at");

CREATE INDEX "context_authorizations_capsule_id_purpose_audience_idx" ON "context_authorizations"("capsule_id", "purpose", "audience");
CREATE INDEX "context_authorizations_subject_participant_id_granted_at_idx" ON "context_authorizations"("subject_participant_id", "granted_at");
CREATE INDEX "context_authorizations_target_type_target_id_purpose_idx" ON "context_authorizations"("target_type", "target_id", "purpose");
CREATE INDEX "context_authorizations_expires_at_revoked_at_idx" ON "context_authorizations"("expires_at", "revoked_at");

CREATE INDEX "chat_analysis_requests_room_id_status_created_at_idx" ON "chat_analysis_requests"("room_id", "status", "created_at");
CREATE UNIQUE INDEX "ux_chat_analysis_requests_room_active"
ON "chat_analysis_requests"("room_id")
WHERE "status" IN ('pending_approval', 'approved', 'submitted', 'processing');
CREATE INDEX "idx_chat_analysis_requests_requester_created" ON "chat_analysis_requests"("requested_by_participant_id", "created_at");
CREATE INDEX "chat_analysis_requests_selection_hash_idx" ON "chat_analysis_requests"("selection_hash");
CREATE INDEX "chat_analysis_requests_expires_at_idx" ON "chat_analysis_requests"("expires_at");
CREATE UNIQUE INDEX "ux_chat_analysis_requests_id_hash_policy" ON "chat_analysis_requests"("id", "selection_hash", "policy_version");

CREATE UNIQUE INDEX "ux_chat_analysis_approvals_request_participant" ON "chat_analysis_participant_approvals"("analysis_request_id", "participant_id");
CREATE INDEX "idx_chat_analysis_approvals_participant_decision" ON "chat_analysis_participant_approvals"("participant_id", "decision", "decision_at");
CREATE INDEX "chat_analysis_participant_approvals_selection_hash_idx" ON "chat_analysis_participant_approvals"("selection_hash");
CREATE INDEX "chat_analysis_participant_approvals_expires_at_revoked_at_idx" ON "chat_analysis_participant_approvals"("expires_at", "revoked_at");

CREATE INDEX "context_use_audits_room_id_created_at_idx" ON "context_use_audits"("room_id", "created_at");
CREATE INDEX "context_use_audits_actor_participant_id_created_at_idx" ON "context_use_audits"("actor_participant_id", "created_at");
CREATE INDEX "context_use_audits_analysis_request_id_idx" ON "context_use_audits"("analysis_request_id");
CREATE INDEX "context_use_audits_capsule_id_idx" ON "context_use_audits"("capsule_id");
CREATE INDEX "context_use_audits_authorization_id_idx" ON "context_use_audits"("authorization_id");
CREATE INDEX "context_use_audits_target_type_target_id_created_at_idx" ON "context_use_audits"("target_type", "target_id", "created_at");
CREATE INDEX "context_use_audits_purpose_audience_decision_created_at_idx" ON "context_use_audits"("purpose", "audience", "decision", "created_at");
CREATE INDEX "context_use_audits_request_correlation_id_idx" ON "context_use_audits"("request_correlation_id");

-- AddForeignKey
ALTER TABLE "chat_channels"
ADD CONSTRAINT "chat_channels_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_channels"
ADD CONSTRAINT "chat_channels_owner_participant_id_fkey"
FOREIGN KEY ("owner_participant_id") REFERENCES "chat_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
ADD CONSTRAINT "chat_messages_channel_id_fkey"
FOREIGN KEY ("channel_id") REFERENCES "chat_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "context_capsules"
ADD CONSTRAINT "context_capsules_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "context_capsules"
ADD CONSTRAINT "context_capsules_owner_participant_id_fkey"
FOREIGN KEY ("owner_participant_id") REFERENCES "chat_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "context_capsules"
ADD CONSTRAINT "context_capsules_source_channel_id_fkey"
FOREIGN KEY ("source_channel_id") REFERENCES "chat_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "context_authorizations"
ADD CONSTRAINT "context_authorizations_capsule_id_fkey"
FOREIGN KEY ("capsule_id", "capsule_content_hash", "policy_version")
REFERENCES "context_capsules"("id", "content_hash", "policy_version") ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE "context_authorizations"
ADD CONSTRAINT "context_authorizations_subject_participant_id_fkey"
FOREIGN KEY ("subject_participant_id") REFERENCES "chat_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chat_analysis_requests"
ADD CONSTRAINT "chat_analysis_requests_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_analysis_requests"
ADD CONSTRAINT "chat_analysis_requests_requested_by_participant_id_fkey"
FOREIGN KEY ("requested_by_participant_id") REFERENCES "chat_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chat_analysis_participant_approvals"
ADD CONSTRAINT "chat_analysis_participant_approvals_analysis_request_id_fkey"
FOREIGN KEY ("analysis_request_id", "selection_hash", "policy_version")
REFERENCES "chat_analysis_requests"("id", "selection_hash", "policy_version") ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE "chat_analysis_participant_approvals"
ADD CONSTRAINT "chat_analysis_participant_approvals_participant_id_fkey"
FOREIGN KEY ("participant_id") REFERENCES "chat_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "context_use_audits"
ADD CONSTRAINT "context_use_audits_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "context_use_audits"
ADD CONSTRAINT "context_use_audits_actor_participant_id_fkey"
FOREIGN KEY ("actor_participant_id") REFERENCES "chat_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "context_use_audits"
ADD CONSTRAINT "context_use_audits_analysis_request_id_fkey"
FOREIGN KEY ("analysis_request_id") REFERENCES "chat_analysis_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "context_use_audits"
ADD CONSTRAINT "context_use_audits_capsule_id_fkey"
FOREIGN KEY ("capsule_id") REFERENCES "context_capsules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "context_use_audits"
ADD CONSTRAINT "context_use_audits_authorization_id_fkey"
FOREIGN KEY ("authorization_id") REFERENCES "context_authorizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
