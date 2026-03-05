-- Chat v1 models (draft migration)
-- NOTE: This migration is intentionally minimal and aligns with schema.prisma additions.

CREATE TYPE "ChatRoomStatus" AS ENUM (
  'solo_active',
  'invite_pending',
  'invite_accepted',
  'group_active',
  'judgment_requested',
  'judgment_completed',
  'judgment_failed',
  'archived'
);

CREATE TYPE "ChatHistoryVisibilityMode" AS ENUM (
  'share_full_history',
  'share_summary_only',
  'share_from_join_time'
);

CREATE TYPE "ChatParticipantType" AS ENUM (
  'user',
  'ai',
  'system'
);

CREATE TYPE "ChatRoleInRoom" AS ENUM (
  'roleA',
  'roleB',
  'aiMediator',
  'system'
);

CREATE TYPE "ChatMessageType" AS ENUM (
  'user_text',
  'ai_reflection',
  'ai_summary',
  'system_event',
  'safety_notice'
);

CREATE TYPE "ChatVisibilityScope" AS ENUM (
  'all',
  'owner_only',
  'summary_only'
);

CREATE TYPE "ChatInviteStatus" AS ENUM (
  'pending',
  'accepted',
  'declined',
  'expired',
  'revoked'
);

CREATE TABLE "chat_rooms" (
  "id" TEXT NOT NULL,
  "status" "ChatRoomStatus" NOT NULL DEFAULT 'solo_active',
  "owner_user_id" TEXT,
  "session_id" VARCHAR(100),
  "history_visibility_mode" "ChatHistoryVisibilityMode" NOT NULL DEFAULT 'share_summary_only',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_participants" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "participant_type" "ChatParticipantType" NOT NULL DEFAULT 'user',
  "user_id" TEXT,
  "role_in_room" "ChatRoleInRoom" NOT NULL,
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "left_at" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_messages" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "sender_participant_id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "message_type" "ChatMessageType" NOT NULL DEFAULT 'user_text',
  "visibility_scope" "ChatVisibilityScope" NOT NULL DEFAULT 'all',
  "safety_flag" BOOLEAN NOT NULL DEFAULT false,
  "safety_detail" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_invites" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "inviter_participant_id" TEXT NOT NULL,
  "invited_user_id" TEXT,
  "invite_code" VARCHAR(12),
  "status" "ChatInviteStatus" NOT NULL DEFAULT 'pending',
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responded_at" TIMESTAMP(3),
  CONSTRAINT "chat_invites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_to_case_links" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "case_id" TEXT NOT NULL,
  "judgment_id" TEXT,
  "triggered_by_participant_id" TEXT,
  "conversion_snapshot" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_to_case_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_invites_invite_code_key" ON "chat_invites"("invite_code");

CREATE INDEX "chat_rooms_owner_user_id_idx" ON "chat_rooms"("owner_user_id");
CREATE INDEX "chat_rooms_session_id_idx" ON "chat_rooms"("session_id");
CREATE INDEX "chat_rooms_status_created_at_idx" ON "chat_rooms"("status", "created_at");

CREATE INDEX "chat_participants_room_id_role_in_room_idx" ON "chat_participants"("room_id", "role_in_room");
CREATE INDEX "chat_participants_user_id_idx" ON "chat_participants"("user_id");
CREATE INDEX "chat_participants_room_id_is_active_idx" ON "chat_participants"("room_id", "is_active");

CREATE INDEX "chat_messages_room_id_created_at_idx" ON "chat_messages"("room_id", "created_at");
CREATE INDEX "chat_messages_sender_participant_id_idx" ON "chat_messages"("sender_participant_id");
CREATE INDEX "chat_messages_room_id_visibility_scope_idx" ON "chat_messages"("room_id", "visibility_scope");

CREATE INDEX "chat_invites_room_id_status_idx" ON "chat_invites"("room_id", "status");
CREATE INDEX "chat_invites_invited_user_id_status_idx" ON "chat_invites"("invited_user_id", "status");
CREATE INDEX "chat_invites_expires_at_idx" ON "chat_invites"("expires_at");

CREATE INDEX "chat_to_case_links_room_id_created_at_idx" ON "chat_to_case_links"("room_id", "created_at");
CREATE INDEX "chat_to_case_links_case_id_idx" ON "chat_to_case_links"("case_id");
CREATE INDEX "chat_to_case_links_judgment_id_idx" ON "chat_to_case_links"("judgment_id");
CREATE INDEX "chat_to_case_links_triggered_by_participant_id_idx" ON "chat_to_case_links"("triggered_by_participant_id");

ALTER TABLE "chat_rooms"
  ADD CONSTRAINT "chat_rooms_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chat_participants"
  ADD CONSTRAINT "chat_participants_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_participants"
  ADD CONSTRAINT "chat_participants_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_sender_participant_id_fkey"
  FOREIGN KEY ("sender_participant_id") REFERENCES "chat_participants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chat_invites"
  ADD CONSTRAINT "chat_invites_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_invites"
  ADD CONSTRAINT "chat_invites_inviter_participant_id_fkey"
  FOREIGN KEY ("inviter_participant_id") REFERENCES "chat_participants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chat_invites"
  ADD CONSTRAINT "chat_invites_invited_user_id_fkey"
  FOREIGN KEY ("invited_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chat_to_case_links"
  ADD CONSTRAINT "chat_to_case_links_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_to_case_links"
  ADD CONSTRAINT "chat_to_case_links_case_id_fkey"
  FOREIGN KEY ("case_id") REFERENCES "cases"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_to_case_links"
  ADD CONSTRAINT "chat_to_case_links_judgment_id_fkey"
  FOREIGN KEY ("judgment_id") REFERENCES "judgments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chat_to_case_links"
  ADD CONSTRAINT "chat_to_case_links_triggered_by_participant_id_fkey"
  FOREIGN KEY ("triggered_by_participant_id") REFERENCES "chat_participants"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
