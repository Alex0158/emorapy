ALTER TABLE reconciliation_plans
ADD COLUMN IF NOT EXISTS version_group_id UUID,
ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS superseded_by_plan_id UUID;

CREATE INDEX IF NOT EXISTS idx_reconciliation_plans_version_group_id
ON reconciliation_plans(version_group_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_plans_judgment_intent_superseded
ON reconciliation_plans(judgment_id, intent, superseded_at);

ALTER TABLE repair_tracks
ADD COLUMN IF NOT EXISTS status_reason VARCHAR(100),
ADD COLUMN IF NOT EXISTS closed_reason VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_replan_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS repair_track_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_track_id UUID NOT NULL REFERENCES repair_tracks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_repair_track_events_track_created
ON repair_track_events(repair_track_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_repair_track_events_type_created
ON repair_track_events(event_type, created_at DESC);
