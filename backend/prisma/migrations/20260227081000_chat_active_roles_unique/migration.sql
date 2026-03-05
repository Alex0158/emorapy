-- Enforce at most one active roleA / aiMediator participant per room.
-- This complements service-layer role uniqueness checks and hardens cross-process consistency.
CREATE UNIQUE INDEX "ux_chat_participants_room_active_rolea"
ON "chat_participants"("room_id")
WHERE "role_in_room" = 'roleA' AND "is_active" = true;

CREATE UNIQUE INDEX "ux_chat_participants_room_active_ai_mediator"
ON "chat_participants"("room_id")
WHERE "role_in_room" = 'aiMediator' AND "is_active" = true;
