import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { connectChatStream, getChatRoom, listChatMessages } from "@/services/api/chat";
import type { ChatMessage, ChatRoom, ChatStreamEvent } from "@/types/chat";
import {
	getHistoryStateAfterLatestRefresh,
	getRoomStreamCloseRetryText,
	getRoomStreamRetryDelayMs,
	getRoomStreamRetryErrorText,
	getRoomStreamTerminalErrorText,
	isRoomStreamReadyEvent,
	isTerminalStreamError,
	mergeSortedMessages,
	shouldAllowMessageCacheTrim,
	shouldRefreshRoomForStreamEvent,
} from "../chatRoomUtils";

interface UseChatRoomLiveUpdatesInput {
	activeRoomId: string | null;
	isRoomTargetActive: (targetRoomId: string) => boolean;
	setRoom: Dispatch<SetStateAction<ChatRoom | null>>;
	setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
	setHistoryCursor: Dispatch<SetStateAction<string | null>>;
	setHasMoreHistory: Dispatch<SetStateAction<boolean>>;
	setErrorText: (value: string) => void;
	trimMessageCache: (
		messages: ChatMessage[],
		opts?: { allowTrim?: boolean },
	) => ChatMessage[];
	isAtBottomRef: { current: boolean };
	pendingAnchorMessageIdRef: { current: string | null };
	loadingMoreHistoryRef: { current: boolean };
	historyCursorRef: { current: string | null };
	hasMoreHistoryRef: { current: boolean };
	showRoomStatusNotice: (event: ChatStreamEvent) => void;
	onRoomRefreshRequested?: (roomId: string) => void;
}

export function useChatRoomLiveUpdates({
	activeRoomId,
	isRoomTargetActive,
	setRoom,
	setMessages,
	setHistoryCursor,
	setHasMoreHistory,
	setErrorText,
	trimMessageCache,
	isAtBottomRef,
	pendingAnchorMessageIdRef,
	loadingMoreHistoryRef,
	historyCursorRef,
	hasMoreHistoryRef,
	showRoomStatusNotice,
	onRoomRefreshRequested,
}: UseChatRoomLiveUpdatesInput) {
	const roomPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const roomStreamCleanupRef = useRef<(() => void) | null>(null);
	const roomStreamRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const roomRefreshInFlightRef = useRef<Promise<void> | null>(null);
	const roomRefreshInFlightRoomIdRef = useRef<string | null>(null);
	const roomRefreshQueuedRef = useRef(false);

	const clearRoomPolling = useCallback(() => {
		if (roomPollingRef.current) {
			clearInterval(roomPollingRef.current);
			roomPollingRef.current = null;
		}
	}, []);

	const clearRoomStreamRetry = useCallback(() => {
		if (roomStreamRetryRef.current) {
			clearTimeout(roomStreamRetryRef.current);
			roomStreamRetryRef.current = null;
		}
	}, []);

	const cleanupRoomStream = useCallback(() => {
		roomStreamCleanupRef.current?.();
		roomStreamCleanupRef.current = null;
	}, []);

	const loadRoomLatestMerge = useCallback(async (targetRoomId: string) => {
		if (!isRoomTargetActive(targetRoomId)) return;
		const [fetchedRoom, fetchedMessages] = await Promise.all([
			getChatRoom(targetRoomId),
			listChatMessages(targetRoomId, { limit: 50 }),
		]);
		if (!isRoomTargetActive(targetRoomId)) return;
		setRoom(fetchedRoom);
		setMessages((prev) => {
			if (prev.length === 0) return fetchedMessages.messages;
			const merged = mergeSortedMessages(prev, fetchedMessages.messages);
			const allowTrim = shouldAllowMessageCacheTrim({
				isAtBottom: isAtBottomRef.current,
				pendingAnchorMessageId: pendingAnchorMessageIdRef.current,
				loadingMoreHistory: loadingMoreHistoryRef.current,
			});
			return trimMessageCache(merged, { allowTrim });
		});
		const nextHistoryState = getHistoryStateAfterLatestRefresh({
			currentCursor: historyCursorRef.current,
			hasMoreHistory: hasMoreHistoryRef.current,
			fetchedNextCursor: fetchedMessages.nextCursor,
		});
		historyCursorRef.current = nextHistoryState.historyCursor;
		hasMoreHistoryRef.current = nextHistoryState.hasMoreHistory;
		setHistoryCursor(nextHistoryState.historyCursor);
		setHasMoreHistory(nextHistoryState.hasMoreHistory);
	}, [
		hasMoreHistoryRef,
		historyCursorRef,
		isAtBottomRef,
		isRoomTargetActive,
		loadingMoreHistoryRef,
		pendingAnchorMessageIdRef,
		setHasMoreHistory,
		setHistoryCursor,
		setMessages,
		setRoom,
		trimMessageCache,
	]);

	const refreshRoomSafely = useCallback(async (targetRoomId: string) => {
		if (!isRoomTargetActive(targetRoomId)) return;
		onRoomRefreshRequested?.(targetRoomId);
		if (
			roomRefreshInFlightRef.current &&
			roomRefreshInFlightRoomIdRef.current === targetRoomId
		) {
			roomRefreshQueuedRef.current = true;
			return roomRefreshInFlightRef.current;
		}
		const run = async () => {
			while (true) {
				roomRefreshQueuedRef.current = false;
				await loadRoomLatestMerge(targetRoomId);
				if (!roomRefreshQueuedRef.current || !isRoomTargetActive(targetRoomId)) {
					break;
				}
			}
		};
		let promise: Promise<void>;
		promise = run().finally(() => {
			if (roomRefreshInFlightRef.current !== promise) return;
			roomRefreshInFlightRef.current = null;
			roomRefreshInFlightRoomIdRef.current = null;
			if (roomRefreshQueuedRef.current && isRoomTargetActive(targetRoomId)) {
				roomRefreshQueuedRef.current = false;
				void refreshRoomSafely(targetRoomId);
				return;
			}
			roomRefreshQueuedRef.current = false;
		});
		roomRefreshQueuedRef.current = false;
		roomRefreshInFlightRoomIdRef.current = targetRoomId;
		roomRefreshInFlightRef.current = promise;
		return promise;
	}, [isRoomTargetActive, loadRoomLatestMerge, onRoomRefreshRequested]);

	const ensureRoomPolling = useCallback((targetRoomId: string) => {
		if (roomPollingRef.current) return;
		roomPollingRef.current = setInterval(() => {
			refreshRoomSafely(targetRoomId).catch(() => undefined);
		}, 8000);
	}, [refreshRoomSafely]);

	useEffect(() => {
		if (!activeRoomId) return;
		let cancelled = false;
		cleanupRoomStream();
		clearRoomStreamRetry();

		const bindStream = async (retryCount = 0) => {
			const scheduleReconnect = (retryFrom: number, errorMessage?: string) => {
				if (!isRoomTargetActive(activeRoomId)) return;
				if (errorMessage) {
					setErrorText(errorMessage);
				}
				ensureRoomPolling(activeRoomId);
				const nextRetry = getRoomStreamRetryDelayMs(retryFrom);
				clearRoomStreamRetry();
				roomStreamRetryRef.current = setTimeout(() => {
					if (cancelled || !isRoomTargetActive(activeRoomId)) return;
					void bindStream(retryFrom + 1);
				}, nextRetry);
			};

			let cleanup: () => void;
			try {
				cleanup = await connectChatStream(activeRoomId, {
					onEvent: (event) => {
						if (cancelled || !isRoomTargetActive(activeRoomId)) return;
						if (isRoomStreamReadyEvent(event)) {
							clearRoomPolling();
							setErrorText("");
							return;
						}
						if (shouldRefreshRoomForStreamEvent(event)) {
							if (event.type === "room_status") {
								showRoomStatusNotice(event);
							}
							void refreshRoomSafely(activeRoomId);
						}
					},
					onError: (streamError) => {
						if (cancelled || !isRoomTargetActive(activeRoomId)) return;
						if (isTerminalStreamError(streamError)) {
							clearRoomStreamRetry();
							clearRoomPolling();
							setErrorText(getRoomStreamTerminalErrorText(streamError));
							return;
						}
						scheduleReconnect(retryCount, getRoomStreamRetryErrorText(streamError));
					},
					onClose: () => {
						if (cancelled || !isRoomTargetActive(activeRoomId)) return;
						scheduleReconnect(retryCount, getRoomStreamCloseRetryText());
					},
				});
			} catch (error) {
				if (cancelled || !isRoomTargetActive(activeRoomId)) return;
				scheduleReconnect(retryCount, getRoomStreamRetryErrorText(error));
				return;
			}
			if (cancelled || !isRoomTargetActive(activeRoomId)) {
				cleanup();
				return;
			}
			roomStreamCleanupRef.current = cleanup;
		};

		void bindStream();
		return () => {
			cancelled = true;
			clearRoomStreamRetry();
			cleanupRoomStream();
		};
	}, [
		activeRoomId,
		clearRoomPolling,
		clearRoomStreamRetry,
		cleanupRoomStream,
		ensureRoomPolling,
		isRoomTargetActive,
		refreshRoomSafely,
		setErrorText,
		showRoomStatusNotice,
	]);

	return {
		clearRoomPolling,
		clearRoomStreamRetry,
		cleanupRoomStream,
		ensureRoomPolling,
		refreshRoomSafely,
	};
}
