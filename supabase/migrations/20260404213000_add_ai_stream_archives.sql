CREATE TABLE IF NOT EXISTS ai_stream_session_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_batch_key varchar(100) NOT NULL,
  stream_id uuid NOT NULL UNIQUE,
  request_id uuid NOT NULL,
  scope_type varchar(50) NOT NULL,
  scope_id uuid NOT NULL,
  status varchar(50) NOT NULL,
  last_seq integer NOT NULL,
  last_event_type varchar(50) NOT NULL,
  actor_role varchar(50),
  text text,
  phase varchar(50),
  message_id uuid,
  metadata jsonb,
  error jsonb,
  backend_mode varchar(20),
  started_at timestamptz,
  completed_at timestamptz,
  persisted_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  source_created_at timestamptz NOT NULL,
  source_updated_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_stream_session_archives_batch_archived_at
  ON ai_stream_session_archives(archive_batch_key, archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_stream_session_archives_scope_updated_at
  ON ai_stream_session_archives(scope_type, scope_id, source_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_stream_session_archives_status_updated_at
  ON ai_stream_session_archives(status, source_updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_stream_event_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_batch_key varchar(100) NOT NULL,
  stream_id uuid NOT NULL,
  request_id uuid NOT NULL,
  scope_type varchar(50) NOT NULL,
  scope_id uuid NOT NULL,
  seq integer NOT NULL,
  event_type varchar(50) NOT NULL,
  actor_role varchar(50),
  message_id uuid,
  delta_text text,
  full_text text,
  phase varchar(50),
  metadata jsonb,
  error jsonb,
  source_created_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_ai_stream_event_archives_stream_seq UNIQUE(stream_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_ai_stream_event_archives_batch_archived_at
  ON ai_stream_event_archives(archive_batch_key, archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_stream_event_archives_scope_seq
  ON ai_stream_event_archives(scope_type, scope_id, seq DESC);
CREATE INDEX IF NOT EXISTS idx_ai_stream_event_archives_type_created_at
  ON ai_stream_event_archives(event_type, source_created_at DESC);
