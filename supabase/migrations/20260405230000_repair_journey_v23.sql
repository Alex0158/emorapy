ALTER TYPE "CommitmentStatus" ADD VALUE IF NOT EXISTS 'deferred';

ALTER TABLE repair_participant_states
ADD COLUMN IF NOT EXISTS response_reason VARCHAR(50),
ADD COLUMN IF NOT EXISTS deferred_until TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP;

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS priority VARCHAR(20),
ADD COLUMN IF NOT EXISTS group_key VARCHAR(100),
ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_notifications_user_snoozed_until
ON notifications(user_id, snoozed_until);
