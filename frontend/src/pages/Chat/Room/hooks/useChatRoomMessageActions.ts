import {
	useCallback,
	useRef,
	useState,
	type Dispatch,
	type SetStateAction,
} from "react";
import { sendChatMessage } from "@/services/api/chat";
import type { ChatMessage, ChatRoom, ChatVisibilityScope } from "@/types/chat";
import {
	buildSendMessagePayload,
	getSendMessageErrorFeedback,
	isRoomActionBlocked,
	type ChatActionFeedback,
} from "../chatRoomUtils";

interface UseChatRoomMessageActionsInput {
	room: ChatRoom | null;
	messageInput: string;
	visibilityScope: ChatVisibilityScope;
	replyTo: ChatMessage | null;
	mountedRef: { current: boolean };
	isRoomTargetActive: (targetRoomId: string) => boolean;
	shouldTrimMessageCacheAfterSend: () => boolean;
	trimMessageCache: (
		messages: ChatMessage[],
		opts?: { allowTrim?: boolean },
	) => ChatMessage[];
	setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
	setMessageInput: (value: string) => void;
	setReplyTo: (message: ChatMessage | null) => void;
	setErrorText: (value: string) => void;
	showAIThinkingDraft: () => void;
	showChatActionFeedback: (feedback: ChatActionFeedback) => void;
}

export function useChatRoomMessageActions({
	room,
	messageInput,
	visibilityScope,
	replyTo,
	mountedRef,
	isRoomTargetActive,
	shouldTrimMessageCacheAfterSend,
	trimMessageCache,
	setMessages,
	setMessageInput,
	setReplyTo,
	setErrorText,
	showAIThinkingDraft,
	showChatActionFeedback,
}: UseChatRoomMessageActionsInput) {
	const [sendingRoomIds, setSendingRoomIds] = useState<Set<string>>(
		() => new Set(),
	);
	const sendingRoomIdsRef = useRef<Set<string>>(new Set());

	const shouldApplySendResult = useCallback(
		(targetRoomId: string) => mountedRef.current && isRoomTargetActive(targetRoomId),
		[isRoomTargetActive, mountedRef],
	);

	const markSending = useCallback((targetRoomId: string) => {
		sendingRoomIdsRef.current.add(targetRoomId);
		setSendingRoomIds(new Set(sendingRoomIdsRef.current));
	}, []);

	const clearSending = useCallback((targetRoomId: string) => {
		const deleted = sendingRoomIdsRef.current.delete(targetRoomId);
		if (deleted && mountedRef.current) {
			setSendingRoomIds(new Set(sendingRoomIdsRef.current));
		}
	}, [mountedRef]);

	const handleSendMessage = useCallback(async () => {
		const targetRoomId = room?.id;
		const targetRoomStatus = room?.status;
		if (!targetRoomId) return;
		if (sendingRoomIdsRef.current.has(targetRoomId)) return;
		if (isRoomActionBlocked(targetRoomStatus)) return;
		const content = messageInput.trim();
		if (!content) return;

		markSending(targetRoomId);
		try {
			const sent = await sendChatMessage(
				targetRoomId,
				buildSendMessagePayload({
					content,
					visibilityScope,
					replyToMessageId: replyTo?.id,
				}),
			);
			if (!shouldApplySendResult(targetRoomId)) return;
			setMessages((prev) => {
				const next = [...prev, sent];
				return trimMessageCache(next, {
					allowTrim: shouldTrimMessageCacheAfterSend(),
				});
			});
			if (visibilityScope === "all") {
				showAIThinkingDraft();
			}
			setMessageInput("");
			setReplyTo(null);
			setErrorText("");
		} catch (error) {
			if (!shouldApplySendResult(targetRoomId)) return;
			showChatActionFeedback(getSendMessageErrorFeedback(error));
		} finally {
			clearSending(targetRoomId);
		}
	}, [
		clearSending,
		markSending,
		messageInput,
		replyTo?.id,
		room?.id,
		room?.status,
		setErrorText,
		setMessageInput,
		setMessages,
		setReplyTo,
		shouldApplySendResult,
		shouldTrimMessageCacheAfterSend,
		showAIThinkingDraft,
		showChatActionFeedback,
		trimMessageCache,
		visibilityScope,
	]);

	return {
		sending: Boolean(room?.id && sendingRoomIds.has(room.id)),
		handleSendMessage,
	};
}
