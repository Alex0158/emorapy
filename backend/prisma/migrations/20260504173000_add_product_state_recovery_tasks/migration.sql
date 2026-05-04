-- Persist product-state audit recovery candidates as manual review tasks.
CREATE TYPE "RecoveryTaskStatus" AS ENUM ('manual_review_required', 'in_review', 'resolved', 'dismissed');
CREATE TYPE "RecoveryTaskSeverity" AS ENUM ('warning', 'critical');

CREATE TABLE "product_state_recovery_tasks" (
    "id" TEXT NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "source_task_id" VARCHAR(200) NOT NULL,
    "proposal_id" VARCHAR(120) NOT NULL,
    "status" "RecoveryTaskStatus" NOT NULL DEFAULT 'manual_review_required',
    "severity" "RecoveryTaskSeverity" NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" TEXT NOT NULL,
    "product_flow" VARCHAR(50),
    "linked_entity_ids" JSONB,
    "recommended_action" TEXT NOT NULL,
    "verification_commands" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "guardrails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "automatic_fix_available" BOOLEAN NOT NULL DEFAULT false,
    "requires_human_approval" BOOLEAN NOT NULL DEFAULT true,
    "occurrence_count" INTEGER NOT NULL DEFAULT 1,
    "first_detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_state_recovery_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_state_recovery_tasks_source_task_id_key" ON "product_state_recovery_tasks"("source_task_id");
CREATE INDEX "idx_product_state_recovery_tasks_status_severity_detected" ON "product_state_recovery_tasks"("status", "severity", "last_detected_at");
CREATE INDEX "idx_product_state_recovery_tasks_entity" ON "product_state_recovery_tasks"("entity_type", "entity_id");
CREATE INDEX "idx_product_state_recovery_tasks_source_proposal" ON "product_state_recovery_tasks"("source", "proposal_id");
