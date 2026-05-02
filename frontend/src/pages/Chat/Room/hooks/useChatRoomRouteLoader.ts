import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type Dispatch,
	type SetStateAction,
} from "react";
import { getChatRoom, listChatMessages } from "@/services/api/chat";
import type { ChatMessage, ChatRoom } from "@/types/chat";
import {
	INITIAL_FIRST_ITEM_INDEX,
	getInitialMessageWindow,
	getRoomLoadErrorText,
	getRouteStateRoom,
	hasMessageAnchorHash,
} from "../chatRoomUtils";

type InitialMessagesResponse = Awaited<ReturnType<typeof listChatMessages>>;
type InitialRoomSnapshot = {
	room: ChatRoom;
	messages: InitialMessagesResponse;
};

interface UseChatRoomRouteLoaderInput {
	routeRoomId?: string;
	locationState: unknown;
	mountedRef: { current: boolean };
	isRoomTargetActive: (targetRoomId: string) => boolean;
	setRoom: Dispatch<SetStateAction<ChatRoom | null>>;
	setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
	setFirstItemIndex: Dispatch<SetStateAction<number>>;
	setErrorText: (value: string) => void;
	setLastInviteCode: (value: string) => void;
	setHasUnread: (value: boolean) => void;
	setHighlightMessageId: (value: string | null) => void;
	setHistoryCursor: Dispatch<SetStateAction<string | null>>;
	setHasMoreHistory: Dispatch<SetStateAction<boolean>>;
	setLoadingMoreHistory: (value: boolean) => void;
	firstItemIndexRef: { current: number };
	messagesRef: { current: ChatMessage[] };
	historyCursorRef: { current: string | null };
	hasMoreHistoryRef: { current: boolean };
	prevMessageCountRef: { current: number };
	isAtBottomRef: { current: boolean };
	clearRoomPolling: () => void;
	ensureRoomPolling: (targetRoomId: string) => void;
	clearJudgmentPolling: () => void;
	cleanupRoomStream: () => void;
	clearRoomStreamRetry: () => void;
	clearHighlightTimer: () => void;
	resetAIDraft: () => void;
	resetHistoryNavigation: () => void;
	scrollToBottom: (behavior?: "auto" | "smooth") => void;
}

export function useChatRoomRouteLoader({
	routeRoomId,
	locationState,
	mountedRef,
	isRoomTargetActive,
	setRoom,
	setMessages,
	setFirstItemIndex,
	setErrorText,
	setLastInviteCode,
	setHasUnread,
	setHighlightMessageId,
	setHistoryCursor,
	setHasMoreHistory,
	setLoadingMoreHistory,
	firstItemIndexRef,
	messagesRef,
	historyCursorRef,
	hasMoreHistoryRef,
	prevMessageCountRef,
	isAtBottomRef,
	clearRoomPolling,
	ensureRoomPolling,
	clearJudgmentPolling,
	cleanupRoomStream,
	clearRoomStreamRetry,
	clearHighlightTimer,
	resetAIDraft,
	resetHistoryNavigation,
	scrollToBottom,
}: UseChatRoomRouteLoaderInput) {
	const [loading, setLoading] = useState(false);
	const loadRetryLockRef = useRef(false);

	const applyInitialMessageWindow = useCallback((messagesResponse: InitialMessagesResponse) => {
		const initialWindow = getInitialMessageWindow(messagesResponse);
		// Keep refs in sync immediately so initial scroll/anchor logic can run before effects flush.
		firstItemIndexRef.current = initialWindow.firstItemIndex;
		messagesRef.current = initialWindow.messages;
		setFirstItemIndex(initialWindow.firstItemIndex);
		setMessages(initialWindow.messages);
		historyCursorRef.current = initialWindow.historyCursor;
		hasMoreHistoryRef.current = initialWindow.hasMoreHistory;
		setHistoryCursor(initialWindow.historyCursor);
		setHasMoreHistory(initialWindow.hasMoreHistory);
	}, [
		firstItemIndexRef,
		hasMoreHistoryRef,
		historyCursorRef,
		messagesRef,
		setFirstItemIndex,
		setHasMoreHistory,
		setHistoryCursor,
		setMessages,
	]);

	const applyInitialRoomSnapshot = useCallback(({
		room: fetchedRoom,
		messages: fetchedMessages,
	}: InitialRoomSnapshot) => {
		setRoom(fetchedRoom);
		applyInitialMessageWindow(fetchedMessages);
	}, [applyInitialMessageWindow, setRoom]);

	const fetchRoomInitial = useCallback(async (targetRoomId: string): Promise<InitialRoomSnapshot> => {
		const [fetchedRoom, fetchedMessages] = await Promise.all([
			getChatRoom(targetRoomId),
			listChatMessages(targetRoomId, { limit: 50 }),
		]);
		return { room: fetchedRoom, messages: fetchedMessages };
	}, []);

	const hasCurrentMessageAnchor = useCallback(() => {
		try {
			return hasMessageAnchorHash(window.location.hash);
		} catch {
			return false;
		}
	}, []);

	const completeInitialRoomLoad = useCallback((targetRoomId: string) => {
		clearRoomPolling();
		ensureRoomPolling(targetRoomId);
		if (!hasCurrentMessageAnchor()) {
			setTimeout(() => scrollToBottom("auto"), 0);
		}
	}, [clearRoomPolling, ensureRoomPolling, hasCurrentMessageAnchor, scrollToBottom]);

	const resetRouteRuntimeState = useCallback(() => {
		prevMessageCountRef.current = 0;
		isAtBottomRef.current = true;
		setRoom(null);
		setHasUnread(false);
		setHighlightMessageId(null);
		setLoadingMoreHistory(false);
		resetHistoryNavigation();
		setLastInviteCode("");
		setErrorText("");
		clearHighlightTimer();
		resetAIDraft();
	}, [
		clearHighlightTimer,
		isAtBottomRef,
		prevMessageCountRef,
		resetAIDraft,
		resetHistoryNavigation,
		setErrorText,
		setHasUnread,
		setHighlightMessageId,
		setLastInviteCode,
		setLoadingMoreHistory,
		setRoom,
	]);

	const clearEntryRouteState = useCallback(() => {
		setRoom(null);
		setMessages([]);
		setFirstItemIndex(INITIAL_FIRST_ITEM_INDEX);
		setErrorText("");
		setLastInviteCode("");
		setHasUnread(false);
		setHighlightMessageId(null);
		setHistoryCursor(null);
		setHasMoreHistory(true);
		setLoadingMoreHistory(false);
		resetHistoryNavigation();
		clearHighlightTimer();
		resetAIDraft();
		firstItemIndexRef.current = INITIAL_FIRST_ITEM_INDEX;
		messagesRef.current = [];
		historyCursorRef.current = null;
		hasMoreHistoryRef.current = true;
	}, [
		clearHighlightTimer,
		firstItemIndexRef,
		hasMoreHistoryRef,
		historyCursorRef,
		messagesRef,
		resetAIDraft,
		resetHistoryNavigation,
		setErrorText,
		setFirstItemIndex,
		setHasMoreHistory,
		setHasUnread,
		setHighlightMessageId,
		setHistoryCursor,
		setLastInviteCode,
		setLoadingMoreHistory,
		setMessages,
		setRoom,
	]);

	const handleRetryLoad = useCallback(() => {
		if (!routeRoomId || loadRetryLockRef.current) return;
		const targetRoomId = routeRoomId;
		loadRetryLockRef.current = true;
		setErrorText("");
		setLoading(true);
		fetchRoomInitial(targetRoomId)
			.then((snapshot) => {
				if (!mountedRef.current || !isRoomTargetActive(targetRoomId)) return;
				applyInitialRoomSnapshot(snapshot);
				completeInitialRoomLoad(targetRoomId);
			})
			.catch((error) => {
				if (!mountedRef.current || !isRoomTargetActive(targetRoomId)) return;
				setErrorText(getRoomLoadErrorText(error));
			})
			.finally(() => {
				if (mountedRef.current && isRoomTargetActive(targetRoomId)) {
					setLoading(false);
				}
				loadRetryLockRef.current = false;
			});
	}, [
		applyInitialRoomSnapshot,
		completeInitialRoomLoad,
		fetchRoomInitial,
		isRoomTargetActive,
		mountedRef,
		routeRoomId,
		setErrorText,
	]);

	useEffect(() => {
		let cancelled = false;
		const init = async () => {
			if (!routeRoomId) {
				clearEntryRouteState();
				clearRoomPolling();
				clearJudgmentPolling();
				cleanupRoomStream();
				clearRoomStreamRetry();
				return;
			}

			resetRouteRuntimeState();
			const stateRoom = getRouteStateRoom(locationState, routeRoomId);
			if (stateRoom) {
				if (!cancelled && isRoomTargetActive(routeRoomId)) setRoom(stateRoom);
				try {
					const messagesResponse = await listChatMessages(routeRoomId, { limit: 50 });
					if (!cancelled && isRoomTargetActive(routeRoomId)) {
						applyInitialMessageWindow(messagesResponse);
						completeInitialRoomLoad(routeRoomId);
					}
				} catch {
					if (!cancelled && isRoomTargetActive(routeRoomId)) {
						setLoading(true);
						setErrorText("");
						try {
							const snapshot = await fetchRoomInitial(routeRoomId);
							if (!cancelled && isRoomTargetActive(routeRoomId)) {
								applyInitialRoomSnapshot(snapshot);
								completeInitialRoomLoad(routeRoomId);
							}
						} catch (e) {
							if (!cancelled && isRoomTargetActive(routeRoomId)) {
								setErrorText(getRoomLoadErrorText(e));
							}
						} finally {
							if (!cancelled && isRoomTargetActive(routeRoomId)) {
								setLoading(false);
							}
						}
					}
				}
			} else {
				setLoading(true);
				try {
					const snapshot = await fetchRoomInitial(routeRoomId);
					if (!cancelled && isRoomTargetActive(routeRoomId)) {
						applyInitialRoomSnapshot(snapshot);
						completeInitialRoomLoad(routeRoomId);
					}
				} catch (error) {
					if (!cancelled && isRoomTargetActive(routeRoomId)) {
						setErrorText(getRoomLoadErrorText(error));
					}
				} finally {
					if (!cancelled && isRoomTargetActive(routeRoomId)) {
						setLoading(false);
					}
				}
			}
		};
		void init();
		return () => {
			cancelled = true;
			clearRoomPolling();
			clearJudgmentPolling();
			cleanupRoomStream();
			clearRoomStreamRetry();
			clearHighlightTimer();
			resetAIDraft();
		};
	}, [
		applyInitialMessageWindow,
		applyInitialRoomSnapshot,
		clearEntryRouteState,
		clearHighlightTimer,
		clearJudgmentPolling,
		clearRoomPolling,
		clearRoomStreamRetry,
		cleanupRoomStream,
		completeInitialRoomLoad,
		fetchRoomInitial,
		isRoomTargetActive,
		locationState,
		resetAIDraft,
		resetRouteRuntimeState,
		routeRoomId,
		setErrorText,
		setRoom,
	]);

	return {
		handleRetryLoad,
		loading,
	};
}
