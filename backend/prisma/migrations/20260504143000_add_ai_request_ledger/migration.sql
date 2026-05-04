-- Add AI request ledger for product-flow cost attribution and AI runtime audit.
CREATE TYPE "AIRequestLedgerStatus" AS ENUM ('started', 'succeeded', 'failed', 'cancelled');

CREATE TABLE "ai_request_ledger" (
    "id" TEXT NOT NULL,
    "request_id" VARCHAR(100) NOT NULL,
    "stream_id" VARCHAR(100),
    "scope_type" VARCHAR(50) NOT NULL DEFAULT 'unknown',
    "scope_id" TEXT,
    "product_flow" VARCHAR(50),
    "source_channel" VARCHAR(50),
    "entry_point" VARCHAR(50),
    "provider" VARCHAR(50) NOT NULL DEFAULT 'openai',
    "model" VARCHAR(100) NOT NULL,
    "request_kind" VARCHAR(50) NOT NULL DEFAULT 'chat_completion',
    "prompt_version" VARCHAR(100),
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "total_tokens" INTEGER,
    "cost_usd" DECIMAL(12,6),
    "status" "AIRequestLedgerStatus" NOT NULL DEFAULT 'started',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "metadata" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_request_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_request_ledger_request_id_key" ON "ai_request_ledger"("request_id");
CREATE INDEX "idx_ai_request_ledger_scope_created" ON "ai_request_ledger"("scope_type", "scope_id", "created_at");
CREATE INDEX "idx_ai_request_ledger_product_flow_created" ON "ai_request_ledger"("product_flow", "created_at");
CREATE INDEX "idx_ai_request_ledger_status_created" ON "ai_request_ledger"("status", "created_at");
CREATE INDEX "idx_ai_request_ledger_stream_id" ON "ai_request_ledger"("stream_id");
