-- Add push provider ticket/receipt tracking fields for Expo push lifecycle.
ALTER TABLE "notifications"
  ADD COLUMN "push_provider" VARCHAR(30),
  ADD COLUMN "push_ticket_id" VARCHAR(100),
  ADD COLUMN "push_ticket_status" VARCHAR(20),
  ADD COLUMN "push_receipt_status" VARCHAR(20),
  ADD COLUMN "push_receipt_checked_at" TIMESTAMP(3),
  ADD COLUMN "push_receipt_error" TEXT;

CREATE INDEX "notifications_push_ticket_id_idx" ON "notifications"("push_ticket_id");
CREATE INDEX "notifications_channel_status_push_receipt_status_idx" ON "notifications"("channel", "status", "push_receipt_status");
