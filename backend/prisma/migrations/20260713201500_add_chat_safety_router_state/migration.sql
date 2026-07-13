-- Durable, action-only safety routing state for private Chat signals.
-- No source text, topic, diagnosis, explanation, or free-form reason is stored.
CREATE TYPE "ChatSafetyRouterAction" AS ENUM (
  'continue',
  'private_checkin',
  'pause_shared',
  'block_joint_repair',
  'crisis_support'
);

CREATE TABLE "chat_safety_router_states" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "owner_participant_id" TEXT NOT NULL,
  "action" "ChatSafetyRouterAction" NOT NULL DEFAULT 'continue',
  "policy_version" VARCHAR(50) NOT NULL,
  "state_version" INTEGER NOT NULL DEFAULT 1,
  "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "chat_safety_router_states_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_safety_router_states_version_check" CHECK ("state_version" > 0),
  CONSTRAINT "chat_safety_router_states_room_fkey"
    FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chat_safety_router_states_owner_fkey"
    FOREIGN KEY ("owner_participant_id") REFERENCES "chat_participants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ux_chat_safety_router_room_owner"
  ON "chat_safety_router_states"("room_id", "owner_participant_id");

CREATE INDEX "idx_chat_safety_router_room_action"
  ON "chat_safety_router_states"("room_id", "action");

CREATE INDEX "chat_safety_router_states_owner_participant_id_idx"
  ON "chat_safety_router_states"("owner_participant_id");
