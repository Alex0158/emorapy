import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type Dispatch,
	type SetStateAction,
} from "react";
import type { VirtuosoHandle } from "react-virtuoso";
import { toast } from "sonner";
import type { ChatMessage, ChatRoom } from "@/types/chat";
import { t } from "@/utils/i18n";
import {
	INITIAL_FIRST_ITEM_INDEX,
	mergeSortedMessages,
	shouldAllowMessageCacheTrim,
	trimMessagesToCacheLimit,
} from "../chatRoomUtils";
import { useChatRoomHistoryNavigation } from "./useChatRoomHistoryNavigation";

interface UseChatRoomHistoryControllerInput {
	room: ChatRoom | null;
	messages: ChatMessage[];
	setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
	mountedRef: { current: boolean };
	isRoomTargetActive: (targetRoomId: string) => boolean;
}

export function useChatRoomHistoryController({
	room,
	messages,
	setMessages,
	mountedRef,
	isRoomTargetActive,
}: UseChatRoomHistoryControllerInput) {
	const [firstItemIndex, setFirstItemIndex] = useState(
		INITIAL_FIRST_ITEM_INDEX,
	);
	const [hasUnread, setHasUnread] = useState(false);
	const [highlightMessageId, setHighlightMessageId] = useState<string | null>(
		null,
	);
	const [historyCursor, setHistoryCursor] = useState<string | null>(null);
	const [hasMoreHistory, setHasMoreHistory] = useState(true);
	const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
	const [pendingAnchorMessageId, setPendingAnchorMessageId] = useState<
		string | null
	>(null);
	const [jumpBackState, setJumpBackState] = useState<{
		originMessageId: string | null;
		wasAtBottom: boolean;
	} | null>(null);

	const highlightTimeoutRef = useRef<number | null>(null);
	const messagesContainerRef = useRef<HTMLElement | null>(null);
	const isAtBottomRef = useRef(true);
	const prevMessageCountRef = useRef(0);
	const messagesRef = useRef<ChatMessage[]>([]);
	const firstItemIndexRef = useRef(firstItemIndex);
	const messageIndexByIdRef = useRef<Map<string, number>>(new Map());
	const loadingMoreHistoryRef = useRef(loadingMoreHistory);
	const historyCursorRef = useRef<string | null>(historyCursor);
	const hasMoreHistoryRef = useRef(hasMoreHistory);
	const pendingAnchorMessageIdRef = useRef<string | null>(
		pendingAnchorMessageId,
	);
	const virtuosoRef = useRef<VirtuosoHandle | null>(null);
	const rangeStartIndexRef = useRef(0);

	useEffect(() => {
		messagesRef.current = messages;
		firstItemIndexRef.current = firstItemIndex;
		const indexMap = new Map<string, number>();
		messages.forEach((message, index) => {
			indexMap.set(message.id, firstItemIndex + index);
		});
		messageIndexByIdRef.current = indexMap;
	}, [firstItemIndex, messages]);

	useEffect(() => {
		loadingMoreHistoryRef.current = loadingMoreHistory;
		pendingAnchorMessageIdRef.current = pendingAnchorMessageId;
	}, [loadingMoreHistory, pendingAnchorMessageId]);

	useEffect(() => {
		historyCursorRef.current = historyCursor;
		hasMoreHistoryRef.current = hasMoreHistory;
	}, [hasMoreHistory, historyCursor]);

	const clearHighlightTimer = useCallback(() => {
		if (!highlightTimeoutRef.current) return;
		clearTimeout(highlightTimeoutRef.current);
		highlightTimeoutRef.current = null;
	}, []);

	const scrollToBottom = useCallback(
		(behavior: "auto" | "smooth" = "smooth") => {
			const api = virtuosoRef.current;
			if (!api) return;
			const list = messagesRef.current;
			if (!Array.isArray(list) || list.length === 0) return;
			api.scrollToIndex({
				index: firstItemIndexRef.current + list.length - 1,
				align: "end",
				behavior,
			});
		},
		[],
	);

	const scrollToMessage = useCallback(
		(targetMessageId: string) => {
			const absoluteIndex = messageIndexByIdRef.current.get(targetMessageId);
			if (absoluteIndex === undefined) {
				toast.info(t("chat.message.referenceNotLoaded"));
				return;
			}
			virtuosoRef.current?.scrollToIndex({
				index: absoluteIndex,
				align: "center",
				behavior: "smooth",
			});
			setHighlightMessageId(targetMessageId);
			clearHighlightTimer();
			highlightTimeoutRef.current = setTimeout(() => {
				setHighlightMessageId(null);
				highlightTimeoutRef.current = null;
			}, 2000);
		},
		[clearHighlightTimer],
	);

	const scrollToMessageIndex = useCallback((index: number) => {
		virtuosoRef.current?.scrollToIndex({
			index,
			align: "start",
			behavior: "smooth",
		});
	}, []);

	const trimMessageCache = useCallback(
		(list: ChatMessage[], options?: { allowTrim?: boolean }) => {
			const result = trimMessagesToCacheLimit(list, {
				allowTrim: options?.allowTrim,
			});
			if (result.removedCount > 0) {
				setFirstItemIndex((current) => current + result.removedCount);
			}
			return result.messages;
		},
		[],
	);

	const shouldTrimMessageCacheAfterSend = useCallback(
		() =>
			shouldAllowMessageCacheTrim({
				isAtBottom: isAtBottomRef.current,
				pendingAnchorMessageId: pendingAnchorMessageIdRef.current,
				loadingMoreHistory: loadingMoreHistoryRef.current,
			}),
		[],
	);

	const historyNavigation = useChatRoomHistoryNavigation({
		room,
		messages,
		hasMoreHistory,
		setHasMoreHistory,
		historyCursor,
		setHistoryCursor,
		loadingMoreHistory,
		setLoadingMoreHistory,
		pendingAnchorMessageId,
		setPendingAnchorMessageId,
		jumpBackState,
		setJumpBackState,
		mountedRef,
		isRoomTargetActive,
		messagesRef,
		firstItemIndexRef,
		messageIndexByIdRef,
		rangeStartIndexRef,
		isAtBottomRef,
		historyCursorRef,
		hasMoreHistoryRef,
		setFirstItemIndex,
		setMessages,
		mergeSortedMessages,
		scrollToMessage,
		scrollToBottom,
		scrollToMessageIndex,
	});

	return {
		...historyNavigation,
		clearHighlightTimer,
		firstItemIndex,
		firstItemIndexRef,
		hasMoreHistory,
		hasMoreHistoryRef,
		hasUnread,
		highlightMessageId,
		historyCursor,
		historyCursorRef,
		isAtBottomRef,
		jumpBackState,
		loadingMoreHistory,
		loadingMoreHistoryRef,
		messageIndexByIdRef,
		messagesContainerRef,
		messagesRef,
		pendingAnchorMessageId,
		pendingAnchorMessageIdRef,
		prevMessageCountRef,
		rangeStartIndexRef,
		scrollToBottom,
		setFirstItemIndex,
		setHasMoreHistory,
		setHasUnread,
		setHighlightMessageId,
		setHistoryCursor,
		setJumpBackState,
		setLoadingMoreHistory,
		setPendingAnchorMessageId,
		shouldTrimMessageCacheAfterSend,
		trimMessageCache,
		virtuosoRef,
	};
}
