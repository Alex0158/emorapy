-- Add new message type for AI mediation
ALTER TYPE "ChatMessageType" ADD VALUE IF NOT EXISTS 'ai_mediation';

-- Add reply reference and AI metadata columns
ALTER TABLE "chat_messages"
  ADD COLUMN IF NOT EXISTS "reply_to_message_id" TEXT,
  ADD COLUMN IF NOT EXISTS "ai_strategy" TEXT,
  ADD COLUMN IF NOT EXISTS "ai_confidence" DOUBLE PRECISION;

-- Index for reply lookup
CREATE INDEX IF NOT EXISTS "chat_messages_reply_to_message_id_idx" ON "chat_messages" ("reply_to_message_id");

-- Self-reference for replies
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_reply_to_message_id_fkey"
    FOREIGN KEY ("reply_to_message_id")
    REFERENCES "chat_messages"("id")
    ON DELETE SET NULL;
