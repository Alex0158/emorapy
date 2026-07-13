import {
	useCallback,
	useEffect,
	useRef,
	type Dispatch,
	type SetStateAction,
} from "react";
import { toast } from 'sonner';
import { getErrorMessage } from "@/utils/apiError";
import { t } from "@/utils/i18n";
import { listChatMessages } from "@/services/api/chat";
import type { ChatMessage, ChatRoom } from "@/types/chat";
import {
	ANCHOR_AUTO_PAGE_LIMIT,
	MAX_MESSAGE_CACHE,
	buildMessageAnchorHash,
	getAnchorHandledKey,
	getAnchorOrigin,
	getFirstItemIndexAfterPrepend,
	getPendingAnchorResolution,
	getUniqueHistoryMessages,
	parseMessageAnchorHash,
	shouldShowHistoryCacheFullNotice,
	type ChatAnchorOrigin,
} from "../chatRoomUtils";
import type { ChatConversationLane } from "./useChatRoomUiState";

interface UseChatRoomHistoryNavigationInput {
	room: ChatRoom | null;
	messages: ChatMessage[];
	activeLane: ChatConversationLane;
	hasMoreHistory: boolean;
	setHasMoreHistory: Dispatch<SetStateAction<boolean>>;
	historyCursor: string | null;
	setHistoryCursor: Dispatch<SetStateAction<string | null>>;
	loadingMoreHistory: boolean;
	setLoadingMoreHistory: Dispatch<SetStateAction<boolean>>;
	pendingAnchorMessageId: string | null;
	setPendingAnchorMessageId: Dispatch<SetStateAction<string | null>>;
	jumpBackState: ChatAnchorOrigin | null;
	setJumpBackState: Dispatch<SetStateAction<ChatAnchorOrigin | null>>;
	mountedRef: { current: boolean };
	isRoomTargetActive: (targetRoomId: string) => boolean;
	messagesRef: { current: ChatMessage[] };
	activeMessagesRef: { current: ChatMessage[] };
	activeFirstItemIndexRef: { current: number };
	messageCacheIndexByIdRef: { current: Map<string, number> };
	activeMessageIndexByIdRef: { current: Map<string, number> };
	rangeStartIndexRef: { current: number };
	isAtBottomRef: { current: boolean };
	historyCursorRef: { current: string | null };
	hasMoreHistoryRef: { current: boolean };
	setFirstItemIndex: Dispatch<SetStateAction<number>>;
	setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
	mergeSortedMessages: (
		current: ChatMessage[],
		incoming: ChatMessage[],
	) => ChatMessage[];
	scrollToMessage: (targetMessageId: string) => void;
	scrollToBottom: (behavior?: "auto" | "smooth") => void;
	scrollToMessageIndex: (index: number) => void;
}

export function useChatRoomHistoryNavigation({
	room,
	messages,
	activeLane,
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
	activeMessagesRef,
	activeFirstItemIndexRef,
	messageCacheIndexByIdRef,
	activeMessageIndexByIdRef,
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
}: UseChatRoomHistoryNavigationInput) {
	const pendingAnchorHandledRef = useRef<string | null>(null);
	const loadMoreHistoryLockRef = useRef(false);
	const anchorAutoPagesRef = useRef(0);
	const anchorJumpOriginRef = useRef<ChatAnchorOrigin | null>(null);
	const historyCacheFullNoticeAtRef = useRef(0);

	const resetHistoryNavigation = useCallback(() => {
		pendingAnchorHandledRef.current = null;
		anchorJumpOriginRef.current = null;
		anchorAutoPagesRef.current = 0;
		loadMoreHistoryLockRef.current = false;
		setPendingAnchorMessageId(null);
		setJumpBackState(null);
	}, [setJumpBackState, setPendingAnchorMessageId]);

	useEffect(() => {
		resetHistoryNavigation();
	}, [activeLane, resetHistoryNavigation]);

	const loadMoreHistory = useCallback(async () => {
		const targetRoomId = room?.id;
		if (!targetRoomId) return;
		if (!isRoomTargetActive(targetRoomId)) return;
		if (!hasMoreHistory) return;
		if (!historyCursor) return;
		if (loadingMoreHistory) return;
		if (loadMoreHistoryLockRef.current) return;

		if (!pendingAnchorMessageId && messagesRef.current.length >= MAX_MESSAGE_CACHE) {
			const now = Date.now();
			if (
				shouldShowHistoryCacheFullNotice({
					now,
					lastNoticeAt: historyCacheFullNoticeAtRef.current,
				})
			) {
				historyCacheFullNoticeAtRef.current = now;
				toast.info(t("chat.message.historyCacheFull"));
			}
			return;
		}

		loadMoreHistoryLockRef.current = true;
		setLoadingMoreHistory(true);

		try {
			const result = await listChatMessages(targetRoomId, {
				cursor: historyCursor,
				limit: 50,
			});
			if (!mountedRef.current || !isRoomTargetActive(targetRoomId)) return;
			if (result.messages.length === 0) {
				historyCursorRef.current = null;
				hasMoreHistoryRef.current = false;
				setHistoryCursor(null);
				setHasMoreHistory(false);
				return;
			}
			const uniqueNew = getUniqueHistoryMessages(
				result.messages,
				messageCacheIndexByIdRef.current,
			);
			if (uniqueNew.length > 0) {
				setFirstItemIndex((prev) =>
					getFirstItemIndexAfterPrepend(prev, uniqueNew.length),
				);
			}
			setMessages((prev) => mergeSortedMessages(uniqueNew, prev));
			historyCursorRef.current = result.nextCursor;
			hasMoreHistoryRef.current = Boolean(result.nextCursor);
			setHistoryCursor(result.nextCursor);
			setHasMoreHistory(Boolean(result.nextCursor));
		} catch (error) {
			if (!mountedRef.current || !isRoomTargetActive(targetRoomId)) return;
			toast.error(getErrorMessage(error, "chat.message.loadMoreFail"));
		} finally {
			if (mountedRef.current && isRoomTargetActive(targetRoomId)) {
				setLoadingMoreHistory(false);
			}
			loadMoreHistoryLockRef.current = false;
		}
	}, [
		hasMoreHistory,
		hasMoreHistoryRef,
		historyCursor,
		historyCursorRef,
		isRoomTargetActive,
		loadingMoreHistory,
		mergeSortedMessages,
		messageCacheIndexByIdRef,
		messagesRef,
		mountedRef,
		pendingAnchorMessageId,
		room?.id,
		setFirstItemIndex,
		setHasMoreHistory,
		setHistoryCursor,
		setLoadingMoreHistory,
		setMessages,
	]);

	const setMessageAnchor = useCallback((messageId: string, opts?: { replace?: boolean }) => {
		try {
			if (typeof window === "undefined") return;
			const nextHash = buildMessageAnchorHash(messageId);
			if (opts?.replace) {
				const url = new URL(window.location.href);
				url.hash = nextHash;
				window.history.replaceState(null, "", url.toString());
				return;
			}
			window.location.hash = nextHash;
		} catch {
			// Ignore browsers/test environments that reject URL mutation.
		}
	}, []);

	const parseAnchorMessageId = useCallback((): string | null => {
		try {
			return parseMessageAnchorHash(window.location.hash || "");
		} catch {
			return null;
		}
	}, []);

	const handleAnchorTarget = useCallback((targetId: string) => {
		const targetRoomId = room?.id;
		if (!targetRoomId) return;
		if (!isRoomTargetActive(targetRoomId)) return;
		const key = getAnchorHandledKey(targetRoomId, targetId);
		if (pendingAnchorHandledRef.current === key) {
			if (activeMessageIndexByIdRef.current.has(targetId)) {
				scrollToMessage(targetId);
			}
			return;
		}
		pendingAnchorHandledRef.current = key;
		anchorAutoPagesRef.current = 0;

		if (!anchorJumpOriginRef.current) {
			anchorJumpOriginRef.current = getAnchorOrigin({
				rangeStartIndex: rangeStartIndexRef.current,
				firstItemIndex: activeFirstItemIndexRef.current,
				messages: activeMessagesRef.current,
				isAtBottom: isAtBottomRef.current,
			});
		}

		if (activeMessageIndexByIdRef.current.has(targetId)) {
			const origin = anchorJumpOriginRef.current;
			if (origin) {
				setJumpBackState(origin);
				anchorJumpOriginRef.current = null;
			}
			scrollToMessage(targetId);
			setPendingAnchorMessageId(null);
			return;
		}
		setPendingAnchorMessageId(targetId);
	}, [
		activeFirstItemIndexRef,
		activeLane,
		activeMessagesRef,
		isAtBottomRef,
		isRoomTargetActive,
		activeMessageIndexByIdRef,
		rangeStartIndexRef,
		room?.id,
		scrollToMessage,
		setJumpBackState,
		setPendingAnchorMessageId,
	]);

	useEffect(() => {
		const targetRoomId = room?.id;
		if (!targetRoomId) return;
		if (!isRoomTargetActive(targetRoomId)) return;
		const targetId = parseAnchorMessageId();
		if (!targetId) return;
		handleAnchorTarget(targetId);
	}, [handleAnchorTarget, isRoomTargetActive, parseAnchorMessageId, room?.id]);

	useEffect(() => {
		const targetRoomId = room?.id;
		if (!targetRoomId) return;
		const onHashChange = () => {
			if (!isRoomTargetActive(targetRoomId)) return;
			const targetId = parseAnchorMessageId();
			if (!targetId) return;
			handleAnchorTarget(targetId);
		};
		window.addEventListener("hashchange", onHashChange);
		return () => {
			window.removeEventListener("hashchange", onHashChange);
		};
	}, [handleAnchorTarget, isRoomTargetActive, parseAnchorMessageId, room?.id]);

	useEffect(() => {
		const targetRoomId = room?.id;
		if (!targetRoomId) return;
		if (!isRoomTargetActive(targetRoomId)) return;
		if (!pendingAnchorMessageId) return;
		const resolution = getPendingAnchorResolution({
			targetLoaded: activeMessageIndexByIdRef.current.has(pendingAnchorMessageId),
			hasMoreHistory,
			loadingMoreHistory,
			historyCursor,
			autoPages: anchorAutoPagesRef.current,
			autoPageLimit: ANCHOR_AUTO_PAGE_LIMIT,
		});

		switch (resolution) {
			case "loaded": {
				const origin = anchorJumpOriginRef.current;
				if (origin) {
					setJumpBackState(origin);
					anchorJumpOriginRef.current = null;
				}
				scrollToMessage(pendingAnchorMessageId);
				setPendingAnchorMessageId(null);
				return;
			}
			case "missing-history":
			case "limit-reached":
				toast.info(t("chat.message.referenceNotLoaded"));
				setPendingAnchorMessageId(null);
				anchorJumpOriginRef.current = null;
				return;
			case "load-more":
				anchorAutoPagesRef.current += 1;
				void loadMoreHistory();
				return;
			case "wait":
				return;
		}
	}, [
		hasMoreHistory,
		historyCursor,
		isRoomTargetActive,
		loadMoreHistory,
		loadingMoreHistory,
		activeMessageIndexByIdRef,
		pendingAnchorMessageId,
		room?.id,
		scrollToMessage,
		setJumpBackState,
		setPendingAnchorMessageId,
	]);

	const handleJumpBack = useCallback(() => {
		const origin = jumpBackState;
		setJumpBackState(null);
		if (!origin) return;
		if (origin.wasAtBottom) {
			scrollToBottom("smooth");
			return;
		}
		if (origin.originMessageId) {
			const idx = activeMessageIndexByIdRef.current.get(origin.originMessageId);
			if (idx !== undefined) {
				scrollToMessageIndex(idx);
			}
		}
	}, [activeMessageIndexByIdRef, jumpBackState, scrollToBottom, scrollToMessageIndex, setJumpBackState]);

	const canRequestMoreHistory =
		hasMoreHistory && Boolean(historyCursor) && messages.length > 0;
	const historyBlockedByCache =
		canRequestMoreHistory &&
		!pendingAnchorMessageId &&
		messages.length >= MAX_MESSAGE_CACHE;
	const canLoadMoreHistory = canRequestMoreHistory && !historyBlockedByCache;

	return {
		canLoadMoreHistory,
		canRequestMoreHistory,
		handleAnchorTarget,
		handleJumpBack,
		historyBlockedByCache,
		loadMoreHistory,
		resetHistoryNavigation,
		setMessageAnchor,
	};
}
