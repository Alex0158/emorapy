import { useMemo } from "react";
import type { ChatRoom } from "@/types/chat";
import { isTerminalChatRoomStatus } from "../chatRoomUtils";

export interface ChatRoomDerivedStateInput {
	room: ChatRoom | null;
	currentUserId?: string;
	sessionId?: string | null;
	sending: boolean;
	creatingInvite: boolean;
	judging: boolean;
}

export function deriveChatRoomState({
	room,
	currentUserId,
	sessionId,
	sending,
	creatingInvite,
	judging,
}: ChatRoomDerivedStateInput) {
	const roomStatus = room?.status;
	const isRoomTerminal = isTerminalChatRoomStatus(roomStatus);
	const isOwner =
		Boolean(room?.owner_user_id && currentUserId && room.owner_user_id === currentUserId) ||
		Boolean(room?.session_id && sessionId && room.session_id === sessionId);
	const hasActiveRoleB = Boolean(
		room?.participants?.some(
			(participant) =>
				participant.role_in_room === "roleB" && participant.is_active,
		),
	);
	const myActiveParticipant =
		room?.participants?.find(
			(participant) =>
				participant.user_id === currentUserId && participant.is_active,
		) ?? null;
	const myRole = myActiveParticipant?.role_in_room ?? (isOwner ? "roleA" : null);

	return {
		roomStatus,
		isRoomTerminal,
		isOwner,
		hasActiveRoleB,
		disableSendMessage:
			!room?.id || sending || isRoomTerminal || roomStatus === "judgment_requested",
		disableCreateInvite:
			!room?.id ||
			creatingInvite ||
			isRoomTerminal ||
			roomStatus === "judgment_requested" ||
			!isOwner ||
			hasActiveRoleB,
		disableRequestJudgment:
			!room?.id ||
			judging ||
			isRoomTerminal ||
			roomStatus === "judgment_requested" ||
			!isOwner,
		myRole,
		canKickB: isOwner && hasActiveRoleB,
		canLeaveRoom: myRole === "roleB",
	};
}

export function useChatRoomDerivedState(input: ChatRoomDerivedStateInput) {
	return useMemo(() => {
		return deriveChatRoomState(input);
	}, [
		input.creatingInvite,
		input.currentUserId,
		input.judging,
		input.room,
		input.sending,
		input.sessionId,
	]);
}
