ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS action_key VARCHAR(50),
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS acted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at
ON notifications(user_id, read_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_dismissed_at
ON notifications(user_id, dismissed_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_acted_at
ON notifications(user_id, acted_at);
