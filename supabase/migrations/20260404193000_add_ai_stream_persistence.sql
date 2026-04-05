CREATE TABLE IF NOT EXISTS ai_stream_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL UNIQUE,
  request_id UUID NOT NULL,
  scope_type VARCHAR(50) NOT NULL,
  scope_id TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  last_seq INTEGER NOT NULL,
  last_event_type VARCHAR(50) NOT NULL,
  actor_role VARCHAR(50),
  text TEXT,
  phase VARCHAR(50),
  message_id UUID,
  metadata JSONB,
  error JSONB,
  backend_mode VARCHAR(20),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  persisted_at TIMESTAMP,
  failed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_stream_sessions_scope_updated_at
  ON ai_stream_sessions(scope_type, scope_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_ai_stream_sessions_request_id
  ON ai_stream_sessions(request_id);
CREATE INDEX IF NOT EXISTS idx_ai_stream_sessions_status_updated_at
  ON ai_stream_sessions(status, updated_at);

CREATE TABLE IF NOT EXISTS ai_stream_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL,
  request_id UUID NOT NULL,
  scope_type VARCHAR(50) NOT NULL,
  scope_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  actor_role VARCHAR(50),
  message_id UUID,
  delta_text TEXT,
  full_text TEXT,
  phase VARCHAR(50),
  metadata JSONB,
  error JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_stream_events_stream_seq
  ON ai_stream_events(stream_id, seq);
CREATE INDEX IF NOT EXISTS idx_ai_stream_events_scope_seq
  ON ai_stream_events(scope_type, scope_id, seq);
CREATE INDEX IF NOT EXISTS idx_ai_stream_events_type_created_at
  ON ai_stream_events(event_type, created_at);
