import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/types/chat";

type ChatVisibilityScope = "all" | "owner_only" | "summary_only";

interface UseChatRoomUiStateInput {
	activeRoomId: string | null;
}

export function useChatRoomUiState({ activeRoomId }: UseChatRoomUiStateInput) {
	const [messageInput, setMessageInput] = useState("");
	const [visibilityScope, setVisibilityScope] = useState<ChatVisibilityScope>("all");
	const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
	const [previewVisible, setPreviewVisible] = useState(false);
	const [selectedForJudgment, setSelectedForJudgment] = useState<string[]>([]);
	const previousActiveRoomIdRef = useRef(activeRoomId);

	const resetRoomUiState = useCallback(() => {
		setMessageInput("");
		setVisibilityScope("all");
		setReplyTo(null);
		setPreviewVisible(false);
		setSelectedForJudgment([]);
	}, []);

	useEffect(() => {
		if (previousActiveRoomIdRef.current === activeRoomId) return;
		previousActiveRoomIdRef.current = activeRoomId;
		resetRoomUiState();
	}, [activeRoomId, resetRoomUiState]);

	const openJudgmentPreview = useCallback((includedMessageIds: string[]) => {
		setSelectedForJudgment(includedMessageIds);
		setPreviewVisible(true);
	}, []);

	const closeJudgmentPreview = useCallback(() => {
		setPreviewVisible(false);
	}, []);

	return {
		closeJudgmentPreview,
		messageInput,
		openJudgmentPreview,
		previewVisible,
		replyTo,
		resetRoomUiState,
		selectedForJudgment,
		setMessageInput,
		setReplyTo,
		setSelectedForJudgment,
		setVisibilityScope,
		visibilityScope,
	};
}
