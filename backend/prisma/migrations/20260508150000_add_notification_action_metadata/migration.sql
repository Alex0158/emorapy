ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "action_key" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "priority" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "group_key" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dismissed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "acted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "snoozed_until" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");
CREATE INDEX IF NOT EXISTS "notifications_user_id_dismissed_at_idx" ON "notifications"("user_id", "dismissed_at");
CREATE INDEX IF NOT EXISTS "notifications_user_id_acted_at_idx" ON "notifications"("user_id", "acted_at");
CREATE INDEX IF NOT EXISTS "notifications_user_id_snoozed_until_idx" ON "notifications"("user_id", "snoozed_until");
