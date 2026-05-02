-- Align reconciliation plan versioning and repair-track persistence models with schema.prisma.
DO $$ BEGIN
  CREATE TYPE "ReconciliationIntent" AS ENUM ('repair', 'cool_down', 'graceful_exit', 'safety_support');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommitmentStatus" AS ENUM ('not_viewed', 'viewed', 'deferred', 'committed', 'declined', 'paused');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RepairTrackStatus" AS ENUM ('draft', 'partner_invited', 'solo_active', 'co_active', 'replanning', 'paused', 'completed', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RepairStepStatus" AS ENUM ('pending', 'active', 'done', 'partial', 'skipped', 'adapted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RepairMode" AS ENUM ('solo', 'co');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RepairCheckInResult" AS ENUM ('done', 'partial', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClosenessLevel" AS ENUM ('closer', 'same', 'farther');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StressLevel" AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "reconciliation_plans"
  ADD COLUMN IF NOT EXISTS "intent" "ReconciliationIntent" NOT NULL DEFAULT 'repair',
  ADD COLUMN IF NOT EXISTS "version_group_id" TEXT,
  ADD COLUMN IF NOT EXISTS "superseded_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "superseded_by_plan_id" TEXT;

CREATE INDEX IF NOT EXISTS "reconciliation_plans_intent_idx" ON "reconciliation_plans"("intent");
CREATE INDEX IF NOT EXISTS "reconciliation_plans_version_group_id_idx" ON "reconciliation_plans"("version_group_id");
CREATE INDEX IF NOT EXISTS "reconciliation_plans_judgment_id_intent_superseded_at_idx" ON "reconciliation_plans"("judgment_id", "intent", "superseded_at");

CREATE TABLE IF NOT EXISTS "repair_tracks" (
  "id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "intent" "ReconciliationIntent" NOT NULL,
  "status" "RepairTrackStatus" NOT NULL DEFAULT 'draft',
  "recommended_mode" "RepairMode" NOT NULL DEFAULT 'solo',
  "current_step_index" INTEGER NOT NULL DEFAULT 0,
  "needs_replan" BOOLEAN NOT NULL DEFAULT false,
  "status_reason" TEXT,
  "closed_reason" TEXT,
  "last_closeness" "ClosenessLevel",
  "last_stress" "StressLevel",
  "last_needs_help" BOOLEAN,
  "last_replan_at" TIMESTAMP(3),
  "partner_invited_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "paused_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "repair_tracks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "repair_tracks_plan_id_key" ON "repair_tracks"("plan_id");
CREATE INDEX IF NOT EXISTS "repair_tracks_status_idx" ON "repair_tracks"("status");
CREATE INDEX IF NOT EXISTS "repair_tracks_intent_idx" ON "repair_tracks"("intent");

CREATE TABLE IF NOT EXISTS "repair_participant_states" (
  "id" TEXT NOT NULL,
  "repair_track_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "commitment_status" "CommitmentStatus" NOT NULL DEFAULT 'not_viewed',
  "response_reason" TEXT,
  "deferred_until" TIMESTAMP(3),
  "last_notified_at" TIMESTAMP(3),
  "responded_at" TIMESTAMP(3),
  "invited_at" TIMESTAMP(3),
  "viewed_at" TIMESTAMP(3),
  "committed_at" TIMESTAMP(3),
  "paused_at" TIMESTAMP(3),
  "declined_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "repair_participant_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "repair_participant_states_repair_track_id_user_id_key" ON "repair_participant_states"("repair_track_id", "user_id");
CREATE INDEX IF NOT EXISTS "repair_participant_states_user_id_commitment_status_idx" ON "repair_participant_states"("user_id", "commitment_status");

CREATE TABLE IF NOT EXISTS "repair_step_progresses" (
  "id" TEXT NOT NULL,
  "repair_track_id" TEXT NOT NULL,
  "step_index" INTEGER NOT NULL,
  "step_title" TEXT NOT NULL,
  "step_content" TEXT NOT NULL,
  "fallback_content" TEXT,
  "pause_rule" TEXT,
  "status" "RepairStepStatus" NOT NULL DEFAULT 'pending',
  "completed_by" TEXT,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "repair_step_progresses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "repair_step_progresses_repair_track_id_step_index_key" ON "repair_step_progresses"("repair_track_id", "step_index");
CREATE INDEX IF NOT EXISTS "repair_step_progresses_repair_track_id_status_idx" ON "repair_step_progresses"("repair_track_id", "status");

CREATE TABLE IF NOT EXISTS "repair_checkins" (
  "id" TEXT NOT NULL,
  "repair_track_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "step_index" INTEGER NOT NULL,
  "result" "RepairCheckInResult" NOT NULL,
  "closeness" "ClosenessLevel" NOT NULL,
  "stress" "StressLevel" NOT NULL,
  "needs_help" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "photos_urls" TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "repair_checkins_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "repair_checkins_repair_track_id_created_at_idx" ON "repair_checkins"("repair_track_id", "created_at");
CREATE INDEX IF NOT EXISTS "repair_checkins_user_id_created_at_idx" ON "repair_checkins"("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "repair_track_events" (
  "id" TEXT NOT NULL,
  "repair_track_id" TEXT NOT NULL,
  "user_id" TEXT,
  "event_type" TEXT NOT NULL,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "repair_track_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "repair_track_events_repair_track_id_created_at_idx" ON "repair_track_events"("repair_track_id", "created_at");
CREATE INDEX IF NOT EXISTS "repair_track_events_event_type_created_at_idx" ON "repair_track_events"("event_type", "created_at");

DO $$ BEGIN
  ALTER TABLE "repair_tracks" ADD CONSTRAINT "repair_tracks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "reconciliation_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "repair_participant_states" ADD CONSTRAINT "repair_participant_states_repair_track_id_fkey" FOREIGN KEY ("repair_track_id") REFERENCES "repair_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "repair_participant_states" ADD CONSTRAINT "repair_participant_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "repair_step_progresses" ADD CONSTRAINT "repair_step_progresses_repair_track_id_fkey" FOREIGN KEY ("repair_track_id") REFERENCES "repair_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "repair_checkins" ADD CONSTRAINT "repair_checkins_repair_track_id_fkey" FOREIGN KEY ("repair_track_id") REFERENCES "repair_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "repair_checkins" ADD CONSTRAINT "repair_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "repair_track_events" ADD CONSTRAINT "repair_track_events_repair_track_id_fkey" FOREIGN KEY ("repair_track_id") REFERENCES "repair_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "repair_track_events" ADD CONSTRAINT "repair_track_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
