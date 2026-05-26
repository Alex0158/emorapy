-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AIStreamPersistenceStatus" AS ENUM (
    'created',
    'queued',
    'started',
    'streaming',
    'completed',
    'persisted',
    'failed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE "ai_stream_sessions" (
    "id" TEXT NOT NULL,
    "stream_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "scope_type" VARCHAR(50) NOT NULL,
    "scope_id" TEXT NOT NULL,
    "status" "AIStreamPersistenceStatus" NOT NULL,
    "last_seq" INTEGER NOT NULL,
    "last_event_type" VARCHAR(50) NOT NULL,
    "actor_role" VARCHAR(50),
    "text" TEXT,
    "phase" VARCHAR(50),
    "message_id" TEXT,
    "metadata" JSONB,
    "error" JSONB,
    "backend_mode" VARCHAR(20),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "persisted_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_stream_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_stream_events" (
    "id" TEXT NOT NULL,
    "stream_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "scope_type" VARCHAR(50) NOT NULL,
    "scope_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "actor_role" VARCHAR(50),
    "message_id" TEXT,
    "delta_text" TEXT,
    "full_text" TEXT,
    "phase" VARCHAR(50),
    "metadata" JSONB,
    "error" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_stream_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_stream_session_archives" (
    "id" TEXT NOT NULL,
    "archive_batch_key" VARCHAR(100) NOT NULL,
    "stream_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "scope_type" VARCHAR(50) NOT NULL,
    "scope_id" TEXT NOT NULL,
    "status" "AIStreamPersistenceStatus" NOT NULL,
    "last_seq" INTEGER NOT NULL,
    "last_event_type" VARCHAR(50) NOT NULL,
    "actor_role" VARCHAR(50),
    "text" TEXT,
    "phase" VARCHAR(50),
    "message_id" TEXT,
    "metadata" JSONB,
    "error" JSONB,
    "backend_mode" VARCHAR(20),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "persisted_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "source_created_at" TIMESTAMP(3) NOT NULL,
    "source_updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_stream_session_archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_stream_event_archives" (
    "id" TEXT NOT NULL,
    "archive_batch_key" VARCHAR(100) NOT NULL,
    "stream_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "scope_type" VARCHAR(50) NOT NULL,
    "scope_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "actor_role" VARCHAR(50),
    "message_id" TEXT,
    "delta_text" TEXT,
    "full_text" TEXT,
    "phase" VARCHAR(50),
    "metadata" JSONB,
    "error" JSONB,
    "source_created_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_stream_event_archives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_stream_sessions_stream_id_key" ON "ai_stream_sessions"("stream_id");

-- CreateIndex
CREATE INDEX "ai_stream_sessions_scope_type_scope_id_updated_at_idx" ON "ai_stream_sessions"("scope_type", "scope_id", "updated_at");

-- CreateIndex
CREATE INDEX "ai_stream_sessions_request_id_idx" ON "ai_stream_sessions"("request_id");

-- CreateIndex
CREATE INDEX "ai_stream_sessions_status_updated_at_idx" ON "ai_stream_sessions"("status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "ux_ai_stream_events_stream_seq" ON "ai_stream_events"("stream_id", "seq");

-- CreateIndex
CREATE INDEX "idx_ai_stream_events_scope_seq" ON "ai_stream_events"("scope_type", "scope_id", "seq");

-- CreateIndex
CREATE INDEX "idx_ai_stream_events_type_created_at" ON "ai_stream_events"("event_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_stream_session_archives_stream_id_key" ON "ai_stream_session_archives"("stream_id");

-- CreateIndex
CREATE INDEX "idx_ai_stream_session_archives_batch_archived_at" ON "ai_stream_session_archives"("archive_batch_key", "archived_at");

-- CreateIndex
CREATE INDEX "idx_ai_stream_session_archives_scope_updated_at" ON "ai_stream_session_archives"("scope_type", "scope_id", "source_updated_at");

-- CreateIndex
CREATE INDEX "idx_ai_stream_session_archives_status_updated_at" ON "ai_stream_session_archives"("status", "source_updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "ux_ai_stream_event_archives_stream_seq" ON "ai_stream_event_archives"("stream_id", "seq");

-- CreateIndex
CREATE INDEX "idx_ai_stream_event_archives_batch_archived_at" ON "ai_stream_event_archives"("archive_batch_key", "archived_at");

-- CreateIndex
CREATE INDEX "idx_ai_stream_event_archives_scope_seq" ON "ai_stream_event_archives"("scope_type", "scope_id", "seq");

-- CreateIndex
CREATE INDEX "idx_ai_stream_event_archives_type_created_at" ON "ai_stream_event_archives"("event_type", "source_created_at");
