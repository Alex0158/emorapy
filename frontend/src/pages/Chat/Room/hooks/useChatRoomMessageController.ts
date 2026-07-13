import {
	useCallback,
	useRef,
	type Dispatch,
	type SetStateAction,
} from "react";
import { useAIStreamSubscription } from "@/hooks/useAIStreamSubscription";
import type { ChatMessage, ChatRoom, ChatVisibilityScope } from "@/types/chat";
import {
	draftFromSnapshot,
	reduceDraftWithEvent,
	type AIStreamDraft,
} from "@/utils/aiStreamState";
import {
	AI_THINKING_TIMEOUT_MS,
	isTerminalStreamError,
	type ChatActionFeedback,
} from "../chatRoomUtils";
import { useChatRoomMessageActions } from "./useChatRoomMessageActions";

interface UseChatRoomMessageControllerInput {
	room: ChatRoom | null;
	activeRoomId: string | null;
	activeChannelId: string | null;
	messageInput: string;
	visibilityScope: ChatVisibilityScope;
	replyTo: ChatMessage | null;
	mountedRef: { current: boolean };
	isRoomTargetActive: (targetRoomId: string) => boolean;
	shouldTrimMessageCacheAfterSend: () => boolean;
	trimMessageCache: (
		messages: ChatMessage[],
		options?: { allowTrim?: boolean },
	) => ChatMessage[];
	setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
	setMessageInput: (value: string) => void;
	setReplyTo: (message: ChatMessage | null) => void;
	setErrorText: (value: string) => void;
	showChatActionFeedback: (feedback: ChatActionFeedback) => void;
	refreshRoomSafely: (targetRoomId: string) => Promise<void>;
}

export function useChatRoomMessageController({
	room,
	activeRoomId,
	activeChannelId,
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
	showChatActionFeedback,
	refreshRoomSafely,
}: UseChatRoomMessageControllerInput) {
	const thinkingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearThinkingTimeout = useCallback(() => {
		if (!thinkingTimeoutRef.current) return;
		clearTimeout(thinkingTimeoutRef.current);
		thinkingTimeoutRef.current = null;
	}, []);

	const {
		state: aiDraft,
		setState: setAIDraft,
		resetState: resetAIDraft,
	} = useAIStreamSubscription<AIStreamDraft | null>({
		scopeType: visibilityScope === "owner_only" ? "chat_channel" : "chat_room",
		scopeId: visibilityScope === "owner_only" ? activeChannelId : activeRoomId,
		enabled: Boolean(visibilityScope === "owner_only" ? activeChannelId : activeRoomId),
		initialState: null,
		reduceReady: (_previous, ready) => {
			const snapshots = Array.isArray(ready.snapshots) ? ready.snapshots : [];
			const latestActive = [...snapshots]
				.sort((first, second) => second.lastSeq - first.lastSeq)
				.find(
					(snapshot) =>
						!["persisted", "failed", "cancelled"].includes(snapshot.status),
				);
			const nextDraft = draftFromSnapshot(latestActive);
			if (nextDraft?.status !== "thinking") {
				clearThinkingTimeout();
			}
			return nextDraft;
		},
		reduceEvent: (previous, event) => {
			if (
				event.eventType === "stream.delta" ||
				event.eventType === "stream.completed"
			) {
				clearThinkingTimeout();
			}
			return reduceDraftWithEvent(previous, event);
		},
		isTerminalError: isTerminalStreamError,
		onEvent: (event) => {
			if (event.eventType === "stream.persisted") {
				void refreshRoomSafely(activeRoomId as string);
			}
			if (
				event.eventType === "stream.persisted" ||
				event.eventType === "stream.failed" ||
				event.eventType === "stream.cancelled"
			) {
				clearThinkingTimeout();
			}
		},
	});

	const showAIThinkingDraft = useCallback(() => {
		clearThinkingTimeout();
		setAIDraft({
			streamId: null,
			requestId: null,
			text: "",
			status: "thinking",
		});
		thinkingTimeoutRef.current = setTimeout(() => {
			if (mountedRef.current) {
				setAIDraft(null);
			}
			thinkingTimeoutRef.current = null;
		}, AI_THINKING_TIMEOUT_MS);
	}, [clearThinkingTimeout, mountedRef, setAIDraft]);

	const { sending, handleSendMessage } = useChatRoomMessageActions({
		room,
		channelId: activeChannelId,
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
	});

	return {
		aiDraft,
		handleSendMessage,
		resetAIDraft,
		sending,
	};
}
