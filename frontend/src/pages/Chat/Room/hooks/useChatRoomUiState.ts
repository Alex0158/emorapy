import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ChatVisibilityScope } from "@/types/chat";

export type ChatConversationLane = "private" | "shared";

type LaneDrafts = Record<ChatConversationLane, string>;
type LaneReplies = Record<ChatConversationLane, ChatMessage | null>;

const EMPTY_DRAFTS: LaneDrafts = { private: "", shared: "" };
const EMPTY_REPLIES: LaneReplies = { private: null, shared: null };

interface UseChatRoomUiStateInput {
	activeRoomId: string | null;
}

export function useChatRoomUiState({ activeRoomId }: UseChatRoomUiStateInput) {
	const [activeLane, setActiveLane] = useState<ChatConversationLane>("private");
	const [drafts, setDrafts] = useState<LaneDrafts>(EMPTY_DRAFTS);
	const [replies, setReplies] = useState<LaneReplies>(EMPTY_REPLIES);
	const previousActiveRoomIdRef = useRef(activeRoomId);
	const messageInput = drafts[activeLane];
	const replyTo = replies[activeLane];
	const visibilityScope: ChatVisibilityScope = activeLane === "private" ? "owner_only" : "all";

	const setMessageInput = useCallback((value: string) => {
		setDrafts((current) => ({ ...current, [activeLane]: value }));
	}, [activeLane]);

	const setReplyTo = useCallback((message: ChatMessage | null) => {
		setReplies((current) => ({ ...current, [activeLane]: message }));
	}, [activeLane]);

	const resetRoomUiState = useCallback(() => {
		setActiveLane("private");
		setDrafts(EMPTY_DRAFTS);
		setReplies(EMPTY_REPLIES);
	}, []);

	useEffect(() => {
		if (previousActiveRoomIdRef.current === activeRoomId) return;
		previousActiveRoomIdRef.current = activeRoomId;
		resetRoomUiState();
	}, [activeRoomId, resetRoomUiState]);

	return useMemo(() => ({
		activeLane,
		messageInput,
		replyTo,
		resetRoomUiState,
		setMessageInput,
		setActiveLane,
		setReplyTo,
		visibilityScope,
	}), [
		activeLane,
		messageInput,
		replyTo,
		resetRoomUiState,
		setMessageInput,
		setReplyTo,
		visibilityScope,
	]);
}
