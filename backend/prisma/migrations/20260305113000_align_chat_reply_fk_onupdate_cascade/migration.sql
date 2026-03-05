-- Align constraint behavior with Prisma relation defaults (ON UPDATE CASCADE).
ALTER TABLE "chat_messages" DROP CONSTRAINT IF EXISTS "chat_messages_reply_to_message_id_fkey";

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_reply_to_message_id_fkey"
  FOREIGN KEY ("reply_to_message_id")
  REFERENCES "chat_messages"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
