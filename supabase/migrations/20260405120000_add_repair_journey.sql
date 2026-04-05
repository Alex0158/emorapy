ALTER TABLE reconciliation_plans
ADD COLUMN IF NOT EXISTS intent VARCHAR(30) NOT NULL DEFAULT 'repair';

CREATE INDEX IF NOT EXISTS idx_reconciliation_plans_intent
ON reconciliation_plans(intent);

CREATE TABLE IF NOT EXISTS repair_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL UNIQUE REFERENCES reconciliation_plans(id) ON DELETE CASCADE,
  intent VARCHAR(30) NOT NULL DEFAULT 'repair',
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  recommended_mode VARCHAR(10) NOT NULL DEFAULT 'solo',
  current_step_index INTEGER NOT NULL DEFAULT 0,
  needs_replan BOOLEAN NOT NULL DEFAULT false,
  last_closeness VARCHAR(20),
  last_stress VARCHAR(20),
  last_needs_help BOOLEAN,
  partner_invited_at TIMESTAMP,
  started_at TIMESTAMP,
  paused_at TIMESTAMP,
  completed_at TIMESTAMP,
  closed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_repair_tracks_status
ON repair_tracks(status);

CREATE INDEX IF NOT EXISTS idx_repair_tracks_intent
ON repair_tracks(intent);

CREATE TABLE IF NOT EXISTS repair_participant_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_track_id UUID NOT NULL REFERENCES repair_tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  commitment_status VARCHAR(30) NOT NULL DEFAULT 'not_viewed',
  invited_at TIMESTAMP,
  viewed_at TIMESTAMP,
  committed_at TIMESTAMP,
  paused_at TIMESTAMP,
  declined_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(repair_track_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_repair_participant_states_user_commitment
ON repair_participant_states(user_id, commitment_status);

CREATE TABLE IF NOT EXISTS repair_step_progresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_track_id UUID NOT NULL REFERENCES repair_tracks(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  step_title TEXT NOT NULL,
  step_content TEXT NOT NULL,
  fallback_content TEXT,
  pause_rule TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(repair_track_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_repair_step_progresses_track_status
ON repair_step_progresses(repair_track_id, status);

CREATE TABLE IF NOT EXISTS repair_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_track_id UUID NOT NULL REFERENCES repair_tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL DEFAULT 0,
  result VARCHAR(20) NOT NULL,
  closeness VARCHAR(20) NOT NULL,
  stress VARCHAR(20) NOT NULL,
  needs_help BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  photos_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_repair_checkins_track_created
ON repair_checkins(repair_track_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_repair_checkins_user_created
ON repair_checkins(user_id, created_at DESC);
