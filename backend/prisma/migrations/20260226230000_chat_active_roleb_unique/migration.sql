-- Enforce at most one active roleB participant per room.
-- This is a DB-level guard for cross-process concurrency races.
CREATE UNIQUE INDEX "ux_chat_participants_room_active_roleb"
ON "chat_participants"("room_id")
WHERE "role_in_room" = 'roleB' AND "is_active" = true;
