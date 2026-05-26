-- Store minimized App telemetry events for release evidence and operational reports.
-- Context is already sanitized by the App adapter and re-sanitized by the backend service.
CREATE TABLE "app_telemetry_events" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'info',
    "route" VARCHAR(200),
    "request_id" VARCHAR(120),
    "app_version" VARCHAR(40),
    "platform" VARCHAR(20),
    "build_number" VARCHAR(40),
    "context" JSONB,
    "user_id" TEXT,
    "session_hash" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_telemetry_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_telemetry_events_created_at_idx" ON "app_telemetry_events"("created_at");
CREATE INDEX "app_telemetry_events_name_created_at_idx" ON "app_telemetry_events"("name", "created_at");
CREATE INDEX "app_telemetry_events_severity_created_at_idx" ON "app_telemetry_events"("severity", "created_at");
CREATE INDEX "app_telemetry_events_platform_created_at_idx" ON "app_telemetry_events"("platform", "created_at");
CREATE INDEX "app_telemetry_events_user_id_created_at_idx" ON "app_telemetry_events"("user_id", "created_at");
CREATE INDEX "app_telemetry_events_session_hash_created_at_idx" ON "app_telemetry_events"("session_hash", "created_at");

ALTER TABLE "app_telemetry_events"
  ADD CONSTRAINT "app_telemetry_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
