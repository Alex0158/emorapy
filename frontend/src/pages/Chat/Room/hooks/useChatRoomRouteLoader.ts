import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type Dispatch,
	type SetStateAction,
} from "react";
import { getChatRoom, listChatChannels, listChatMessages } from "@/services/api/chat";
import type { ChatChannel, ChatMessage, ChatRoom } from "@/types/chat";
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
	channels: ChatChannel[];
};

interface UseChatRoomRouteLoaderInput {
	routeRoomId?: string;
	locationState: unknown;
	mountedRef: { current: boolean };
	isRoomTargetActive: (targetRoomId: string) => boolean;
	setRoom: Dispatch<SetStateAction<ChatRoom | null>>;
	setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
	setChannels: Dispatch<SetStateAction<ChatChannel[]>>;
	setFirstItemIndex: Dispatch<SetStateAction<number>>;
	setErrorText: (value: string) => void;
	setLastInviteCode: (value: string) => void;
	setHighlightMessageId: (value: string | null) => void;
	setHistoryCursor: Dispatch<SetStateAction<string | null>>;
	setHasMoreHistory: Dispatch<SetStateAction<boolean>>;
	setLoadingMoreHistory: (value: boolean) => void;
	firstItemIndexRef: { current: number };
	messagesRef: { current: ChatMessage[] };
	historyCursorRef: { current: string | null };
	hasMoreHistoryRef: { current: boolean };
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
	setChannels,
	setFirstItemIndex,
	setErrorText,
	setLastInviteCode,
	setHighlightMessageId,
	setHistoryCursor,
	setHasMoreHistory,
	setLoadingMoreHistory,
	firstItemIndexRef,
	messagesRef,
	historyCursorRef,
	hasMoreHistoryRef,
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
		channels: fetchedChannels,
	}: InitialRoomSnapshot) => {
		setRoom(fetchedRoom);
		setChannels(fetchedChannels);
		applyInitialMessageWindow(fetchedMessages);
	}, [applyInitialMessageWindow, setChannels, setRoom]);

	const fetchRoomInitial = useCallback(async (targetRoomId: string): Promise<InitialRoomSnapshot> => {
		const [fetchedRoom, fetchedMessages, fetchedChannels] = await Promise.all([
			getChatRoom(targetRoomId),
			listChatMessages(targetRoomId, { limit: 50 }),
			listChatChannels(targetRoomId),
		]);
		return { room: fetchedRoom, messages: fetchedMessages, channels: fetchedChannels };
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
		setRoom(null);
		setChannels([]);
		setHighlightMessageId(null);
		setLoadingMoreHistory(false);
		resetHistoryNavigation();
		setLastInviteCode("");
		setErrorText("");
		clearHighlightTimer();
		resetAIDraft();
	}, [
		clearHighlightTimer,
		resetAIDraft,
		resetHistoryNavigation,
		setErrorText,
		setHighlightMessageId,
		setLastInviteCode,
		setLoadingMoreHistory,
		setRoom,
		setChannels,
	]);

	const clearEntryRouteState = useCallback(() => {
		setRoom(null);
		setMessages([]);
		setChannels([]);
		setFirstItemIndex(INITIAL_FIRST_ITEM_INDEX);
		setErrorText("");
		setLastInviteCode("");
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
		setHighlightMessageId,
		setHistoryCursor,
		setLastInviteCode,
		setLoadingMoreHistory,
		setMessages,
		setChannels,
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
					const [messagesResponse, fetchedChannels] = await Promise.all([
						listChatMessages(routeRoomId, { limit: 50 }),
						listChatChannels(routeRoomId),
					]);
					if (!cancelled && isRoomTargetActive(routeRoomId)) {
						setChannels(fetchedChannels);
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
