import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Card, Space, Spin, message } from 'antd';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import { useAIStreamSubscription } from '@/hooks/useAIStreamSubscription';
import { draftFromSnapshot, reduceDraftWithEvent, type AIStreamDraft } from '@/utils/aiStreamState';
import {
  acceptChatInvite,
  connectChatStream,
  createChatInvite,
  createChatRoom,
  declineChatInvite,
  getChatJudgmentStatus,
  getChatRoom,
  kickChatParticipantB,
  listChatMessages,
  requestChatJudgment,
  sendChatMessage,
  leaveChatRoom,
} from '@/services/api/chat';
import type { ChatMessage, ChatRoom, ChatRoomStatus } from '@/types/chat';
import { useAuthStore } from '@/store/authStore';
import { sessionStorage } from '@/utils/storage';
import type { VirtuosoHandle } from 'react-virtuoso';
import ChatRoomEntrySection from './components/ChatRoomEntrySection';
import ChatRoomHeader from './components/ChatRoomHeader';
import ChatRoomAlerts from './components/ChatRoomAlerts';
import ChatMessageList from './components/ChatMessageList';
import ChatMessageComposer from './components/ChatMessageComposer';
import ChatJudgmentPanel, { getJudgmentPreviewInfo } from './components/ChatJudgmentPanel';
import './index.less';

const MAX_MESSAGE_CACHE = 600;
const ANCHOR_AUTO_PAGE_LIMIT = 6;
const INITIAL_FIRST_ITEM_INDEX = 100_000;
const AI_THINKING_TIMEOUT_MS = 15000;

const ChatRoomPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomId: routeRoomId } = useParams<{ roomId: string }>();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [firstItemIndex, setFirstItemIndex] = useState(INITIAL_FIRST_ITEM_INDEX);
  const [loading, setLoading] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [joiningInvite, setJoiningInvite] = useState(false);
  const [decliningInvite, setDecliningInvite] = useState(false);
  const [sending, setSending] = useState(false);
  const [judging, setJudging] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [lastInviteCode, setLastInviteCode] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [visibilityScope, setVisibilityScope] = useState<'all' | 'owner_only' | 'summary_only'>('all');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [visibilityMode, setVisibilityMode] = useState<'share_full_history' | 'share_summary_only' | 'share_from_join_time'>(
    'share_summary_only'
  );
  const [errorText, setErrorText] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedForJudgment, setSelectedForJudgment] = useState<string[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [pendingAnchorMessageId, setPendingAnchorMessageId] = useState<string | null>(null);
  const [jumpBackState, setJumpBackState] = useState<{ originMessageId: string | null; wasAtBottom: boolean } | null>(null);
  const mountedRef = useMountedRef();
  const judgmentPollingRef = useRef<number | null>(null);
  const judgmentPollingAttemptsRef = useRef(0);
  const judgmentPollingRoomIdRef = useRef<string | null>(null);
  const roomPollingRef = useRef<number | null>(null);
  const roomStreamCleanupRef = useRef<(() => void) | null>(null);
  const roomStreamRetryRef = useRef<number | null>(null);
  const roomRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const roomRefreshQueuedRef = useRef(false);
  const createRoomLockRef = useRef(false);
  const joinInviteLockRef = useRef(false);
  const loadRetryLockRef = useRef(false);
  const declineInviteLockRef = useRef(false);
  const sendMessageLockRef = useRef(false);
  const createInviteLockRef = useRef(false);
  const requestJudgmentLockRef = useRef(false);
  const lastRoomStatusNoticeAtRef = useRef<string | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const messagesContainerRef = useRef<HTMLElement | null>(null);
  const isAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const messagesRef = useRef<ChatMessage[]>([]);
  const firstItemIndexRef = useRef(firstItemIndex);
  const messageIndexByIdRef = useRef<Map<string, number>>(new Map());
  const pendingAnchorHandledRef = useRef<string | null>(null);
  const loadMoreHistoryLockRef = useRef(false);
  const anchorAutoPagesRef = useRef(0);
  const anchorJumpOriginRef = useRef<{ originMessageId: string | null; wasAtBottom: boolean } | null>(null);
  const historyCacheFullNoticeAtRef = useRef(0);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const rangeStartIndexRef = useRef(0);
  const thinkingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRoomPolling = useCallback(() => {
    if (roomPollingRef.current) {
      clearInterval(roomPollingRef.current);
      roomPollingRef.current = null;
    }
  }, []);

  const clearJudgmentPolling = useCallback(() => {
    if (judgmentPollingRef.current) {
      clearInterval(judgmentPollingRef.current);
      judgmentPollingRef.current = null;
    }
    judgmentPollingAttemptsRef.current = 0;
    judgmentPollingRoomIdRef.current = null;
  }, []);

  const clearRoomStreamRetry = useCallback(() => {
    if (roomStreamRetryRef.current) {
      clearTimeout(roomStreamRetryRef.current);
      roomStreamRetryRef.current = null;
    }
  }, []);

  const clearThinkingTimeout = useCallback(() => {
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current);
      thinkingTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
    firstItemIndexRef.current = firstItemIndex;
    const indexMap = new Map<string, number>();
    messages.forEach((m, idx) => indexMap.set(m.id, firstItemIndex + idx));
    messageIndexByIdRef.current = indexMap;
  }, [firstItemIndex, messages]);

  const clearHighlightTimer = useCallback(() => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  }, []);

  const isTerminalStreamError = useCallback((error: { code?: string; status?: number }) => {
    if (error.status && [400, 401, 403, 404].includes(error.status)) {
      return true;
    }
    if (error.code && ['INVALID_SESSION_ID', 'SESSION_EXPIRED', 'FORBIDDEN', 'NOT_FOUND'].includes(error.code)) {
      return true;
    }
    return false;
  }, []);

  const getRoomLoadErrorText = useCallback((error: unknown) => {
    const err = error as { code?: string };
    if (err?.code === 'NOT_FOUND' || err?.code === 'HTTP_404') {
      return t('chat.message.roomUnavailable');
    }
    return getErrorMessage(error, 'chat.message.loadFail');
  }, []);

  const isRoomTerminalStatus = useCallback((status?: ChatRoomStatus) => {
    return status === 'judgment_completed' || status === 'judgment_failed' || status === 'archived';
  }, []);

  const showRoomStatusNotice = useCallback((event: { at?: string; payload?: Record<string, unknown> }) => {
    if (!mountedRef.current) return;
    const at = typeof event.at === 'string' ? event.at : null;
    if (at && lastRoomStatusNoticeAtRef.current === at) return;

    const payload = event.payload ?? {};
    const participantLeft = payload.participantLeft === true;
    const participantKicked = payload.participantKicked === true;
    const joined = payload.joined === true;

    if (joined) {
      message.success(t('chat.stream.joined'));
    } else if (participantKicked) {
      message.info(t('chat.stream.participantKicked'));
    } else if (participantLeft) {
      message.info(t('chat.stream.participantLeft'));
    }

    lastRoomStatusNoticeAtRef.current = at ?? String(Date.now());
  }, [mountedRef]);

  const getRoleLabel = useCallback((role: string | null | undefined) => {
    const r = role ?? 'unknown';
    if (r === 'roleA') return t('chat.role.roleA');
    if (r === 'roleB') return t('chat.role.roleB');
    if (r === 'aiMediator') return t('chat.role.aiMediator');
    if (r === 'system') return t('chat.role.system');
    return t('chat.role.unknown');
  }, []);

  const getMessageTypeLabel = useCallback((messageType: string | null | undefined) => {
    if (!messageType) return t('common.na');
    const translated = t(`chat.messageType.${messageType}`);
    return translated === `chat.messageType.${messageType}` ? messageType : translated;
  }, []);

  const getVisibilityScopeLabel = useCallback((visibilityScope: string | null | undefined) => {
    if (!visibilityScope) return t('common.na');
    const translated = t(`chat.visibility.${visibilityScope}`);
    return translated === `chat.visibility.${visibilityScope}` ? visibilityScope : translated;
  }, []);

  const getAiStrategyLabel = useCallback((strategy: string | null | undefined) => {
    if (!strategy) return '';
    return t('chat.aiStrategyLabel', { strategy });
  }, []);

  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'smooth') => {
    const api = virtuosoRef.current;
    if (!api) return;
    const list = messagesRef.current;
    if (!Array.isArray(list) || list.length === 0) return;
    api.scrollToIndex({ index: firstItemIndexRef.current + list.length - 1, align: 'end', behavior });
  }, []);

  const scrollToMessage = useCallback((targetMessageId: string) => {
    const absIndex = messageIndexByIdRef.current.get(targetMessageId);
    if (absIndex === undefined) {
      message.info(t('chat.message.referenceNotLoaded'));
      return;
    }
    virtuosoRef.current?.scrollToIndex({ index: absIndex, align: 'center', behavior: 'smooth' });
    setHighlightMessageId(targetMessageId);
    clearHighlightTimer();
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightMessageId(null);
      highlightTimeoutRef.current = null;
    }, 2000);
  }, [clearHighlightTimer]);

  const mergeSortedMessages = useCallback((a: ChatMessage[], b: ChatMessage[]) => {
    if (a.length === 0) return b;
    if (b.length === 0) return a;

    const seen = new Set<string>();
    const result: ChatMessage[] = [];
    let i = 0;
    let j = 0;

    const pushUnique = (m: ChatMessage) => {
      if (seen.has(m.id)) return;
      seen.add(m.id);
      result.push(m);
    };

    // Both a & b should be sorted ascending by created_at (server guarantees).
    while (i < a.length || j < b.length) {
      const left = i < a.length ? a[i] : null;
      const right = j < b.length ? b[j] : null;
      if (!left) {
        pushUnique(right!);
        j += 1;
        continue;
      }
      if (!right) {
        pushUnique(left);
        i += 1;
        continue;
      }
      const lt = new Date(left.created_at).getTime();
      const rt = new Date(right.created_at).getTime();
      if (lt < rt) {
        pushUnique(left);
        i += 1;
        continue;
      }
      if (rt < lt) {
        pushUnique(right);
        j += 1;
        continue;
      }
      // Same timestamp: keep deterministic order.
      if (left.id <= right.id) {
        pushUnique(left);
        i += 1;
      } else {
        pushUnique(right);
        j += 1;
      }
    }

    return result;
  }, []);

  const trimMessageCache = useCallback((list: ChatMessage[], opts?: { allowTrim?: boolean }) => {
    if (!opts?.allowTrim) return list;
    if (list.length <= MAX_MESSAGE_CACHE) return list;
    const removeCount = list.length - MAX_MESSAGE_CACHE;
    setFirstItemIndex((prev) => prev + removeCount);
    return list.slice(removeCount);
  }, []);

  const loadRoomInitial = useCallback(async (targetRoomId: string) => {
    const [fetchedRoom, fetchedMessages] = await Promise.all([
      getChatRoom(targetRoomId),
      listChatMessages(targetRoomId, { limit: 50 }),
    ]);
    setRoom(fetchedRoom);
    // Keep refs in sync immediately so initial scroll/anchor logic can run before effects flush.
    firstItemIndexRef.current = INITIAL_FIRST_ITEM_INDEX;
    messagesRef.current = fetchedMessages.messages;
    setFirstItemIndex(INITIAL_FIRST_ITEM_INDEX);
    setMessages(fetchedMessages.messages);
    setHistoryCursor(fetchedMessages.nextCursor);
    setHasMoreHistory(!!fetchedMessages.nextCursor);
  }, []);

  const loadRoomLatestMerge = useCallback(async (targetRoomId: string) => {
    const [fetchedRoom, fetchedMessages] = await Promise.all([
      getChatRoom(targetRoomId),
      listChatMessages(targetRoomId, { limit: 50 }),
    ]);
    setRoom(fetchedRoom);
    setMessages((prev) => {
      if (prev.length === 0) return fetchedMessages.messages;
      const merged = mergeSortedMessages(prev, fetchedMessages.messages);
      const allowTrim = isAtBottomRef.current && !pendingAnchorMessageId && !loadingMoreHistory;
      return trimMessageCache(merged, { allowTrim });
    });
    setHistoryCursor((prev) => (prev ?? fetchedMessages.nextCursor));
  }, [loadingMoreHistory, mergeSortedMessages, pendingAnchorMessageId, trimMessageCache]);

  const refreshRoomSafely = useCallback(async (targetRoomId: string) => {
    if (roomRefreshInFlightRef.current) {
      roomRefreshQueuedRef.current = true;
      return roomRefreshInFlightRef.current;
    }
    const run = async () => {
      while (true) {
        roomRefreshQueuedRef.current = false;
        await loadRoomLatestMerge(targetRoomId);
        if (!roomRefreshQueuedRef.current) {
          break;
        }
      }
    };
    const promise = run()
      .finally(() => {
        roomRefreshInFlightRef.current = null;
        if (roomRefreshQueuedRef.current) {
          roomRefreshQueuedRef.current = false;
          void refreshRoomSafely(targetRoomId);
        }
      });
    roomRefreshInFlightRef.current = promise;
    return promise;
  }, [loadRoomLatestMerge]);

  const activeRoomId = room?.id ?? null;
  const {
    state: aiDraft,
    setState: setAIDraft,
    resetState: resetAIDraft,
  } = useAIStreamSubscription<AIStreamDraft | null>({
    scopeType: 'chat_room',
    scopeId: activeRoomId,
    enabled: !!activeRoomId,
    initialState: null,
    reduceReady: (_prev, ready) => {
      const snapshots = Array.isArray(ready.snapshots) ? ready.snapshots : [];
      const latestActive = [...snapshots]
        .sort((a, b) => b.lastSeq - a.lastSeq)
        .find((snapshot) => !['persisted', 'failed', 'cancelled'].includes(snapshot.status));
      const nextDraft = draftFromSnapshot(latestActive);
      if (nextDraft?.status !== 'thinking') {
        clearThinkingTimeout();
      }
      return nextDraft;
    },
    reduceEvent: (prev, event) => {
      if (event.eventType === 'stream.delta' || event.eventType === 'stream.completed') {
        clearThinkingTimeout();
      }
      return reduceDraftWithEvent(prev, event);
    },
    isTerminalError: isTerminalStreamError,
    onEvent: (event) => {
      if (event.eventType === 'stream.persisted') {
        void refreshRoomSafely(activeRoomId as string);
      }
      if (event.eventType === 'stream.persisted' || event.eventType === 'stream.failed' || event.eventType === 'stream.cancelled') {
        clearThinkingTimeout();
      }
    },
  });

  const ensureRoomPolling = useCallback((targetRoomId: string) => {
    if (roomPollingRef.current) return;
    roomPollingRef.current = setInterval(() => {
      refreshRoomSafely(targetRoomId).catch(() => undefined);
    }, 8000);
  }, [refreshRoomSafely]);

  const handleRetryLoad = useCallback(() => {
    if (!routeRoomId || loadRetryLockRef.current) return;
    loadRetryLockRef.current = true;
    setErrorText('');
    setLoading(true);
    loadRoomInitial(routeRoomId)
      .then(() => {
        if (routeRoomId) {
          ensureRoomPolling(routeRoomId);
        }
      })
      .catch((error) => {
        setErrorText(getRoomLoadErrorText(error));
      })
      .finally(() => {
        setLoading(false);
        loadRetryLockRef.current = false;
      });
  }, [routeRoomId, loadRoomInitial, ensureRoomPolling, getRoomLoadErrorText]);

  const tryStartJudgmentPolling = useCallback((targetRoomId: string) => {
    if (judgmentPollingRoomIdRef.current === targetRoomId && judgmentPollingRef.current) {
      return;
    }
    clearJudgmentPolling();
    judgmentPollingAttemptsRef.current = 0;
    judgmentPollingRoomIdRef.current = targetRoomId;
    judgmentPollingRef.current = setInterval(async () => {
      try {
        judgmentPollingAttemptsRef.current += 1;
        if (judgmentPollingAttemptsRef.current > 90) {
          clearJudgmentPolling();
          setJudging(false);
          requestJudgmentLockRef.current = false;
          message.warning(t('chat.message.judgmentPollingTimeout'));
          return;
        }
        const status = await getChatJudgmentStatus(targetRoomId);
        if (status.latestLink?.judgment?.id) {
          clearJudgmentPolling();
          if (!mountedRef.current) return;
          message.success(t('chat.message.judgmentReady'));
          navigate(`/judgment/${status.latestLink.judgment.id}`);
          return;
        }
        if (status.roomStatus === 'judgment_failed') {
          clearJudgmentPolling();
          setJudging(false);
          message.warning(t('chat.message.judgmentFailed'));
        }
      } catch {
        // keep polling, avoid interrupting user flow
      }
    }, 4000);
  }, [clearJudgmentPolling, navigate]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!routeRoomId) {
        setRoom(null);
        setMessages([]);
        setErrorText('');
        setHistoryCursor(null);
        setHasMoreHistory(true);
        setPendingAnchorMessageId(null);
        setJumpBackState(null);
        resetAIDraft();
        pendingAnchorHandledRef.current = null;
        anchorJumpOriginRef.current = null;
        anchorAutoPagesRef.current = 0;
        clearRoomPolling();
        clearJudgmentPolling();
        roomStreamCleanupRef.current?.();
        roomStreamCleanupRef.current = null;
        clearRoomStreamRetry();
        return;
      }
      prevMessageCountRef.current = 0;
      isAtBottomRef.current = true;
      setHasUnread(false);
      setHighlightMessageId(null);
      clearHighlightTimer();
      anchorAutoPagesRef.current = 0;
      setJumpBackState(null);
      pendingAnchorHandledRef.current = null;
      anchorJumpOriginRef.current = null;
      setErrorText('');
      resetAIDraft();
      const stateRoom = (location.state as { room?: ChatRoom } | null)?.room;
      const useFastPath = stateRoom?.id === routeRoomId;
      if (useFastPath) {
        if (!cancelled) setRoom(stateRoom!);
        try {
          const r = await listChatMessages(routeRoomId, { limit: 50 });
          if (!cancelled) {
            firstItemIndexRef.current = INITIAL_FIRST_ITEM_INDEX;
            messagesRef.current = r.messages;
            setFirstItemIndex(INITIAL_FIRST_ITEM_INDEX);
            setMessages(r.messages);
            setHistoryCursor(r.nextCursor);
            setHasMoreHistory(!!r.nextCursor);
          }
          if (!cancelled) {
            clearRoomPolling();
            ensureRoomPolling(routeRoomId);
            const hasAnchor = (() => {
              try { return typeof window.location.hash === 'string' && window.location.hash.startsWith('#msg-'); } catch { return false; }
            })();
            if (!hasAnchor) {
              setTimeout(() => scrollToBottom('auto'), 0);
            }
          }
        } catch {
          if (!cancelled) {
            setLoading(true);
            setErrorText('');
            try {
              await loadRoomInitial(routeRoomId);
              if (!cancelled) {
                clearRoomPolling();
                ensureRoomPolling(routeRoomId);
                const hasAnchor = (() => {
                  try { return typeof window.location.hash === 'string' && window.location.hash.startsWith('#msg-'); } catch { return false; }
                })();
                if (!hasAnchor) {
                  setTimeout(() => scrollToBottom('auto'), 0);
                }
              }
            } catch (e) {
              if (!cancelled) {
                setErrorText(getRoomLoadErrorText(e));
              }
            } finally {
              if (!cancelled) {
                setLoading(false);
              }
            }
          }
        }
      } else {
        setLoading(true);
        try {
          await loadRoomInitial(routeRoomId);
          if (!cancelled) {
            clearRoomPolling();
            ensureRoomPolling(routeRoomId);
            const hasAnchor = (() => {
              try { return typeof window.location.hash === 'string' && window.location.hash.startsWith('#msg-'); } catch { return false; }
            })();
            if (!hasAnchor) {
              setTimeout(() => scrollToBottom('auto'), 0);
            }
          }
        } catch (error) {
          if (!cancelled) {
            setErrorText(getRoomLoadErrorText(error));
          }
        } finally {
          if (!cancelled) {
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
      roomStreamCleanupRef.current?.();
      roomStreamCleanupRef.current = null;
      clearRoomStreamRetry();
      clearHighlightTimer();
      resetAIDraft();
    };
  }, [location.state, routeRoomId, clearJudgmentPolling, clearRoomPolling, loadRoomInitial, ensureRoomPolling, clearRoomStreamRetry, clearHighlightTimer, scrollToBottom, getRoomLoadErrorText, resetAIDraft]);

  useEffect(() => {
    const activeRoomId = room?.id ?? null;
    if (!activeRoomId) return;
    let cancelled = false;
    roomStreamCleanupRef.current?.();
    roomStreamCleanupRef.current = null;
    clearRoomStreamRetry();

    const bindStream = async (retryCount = 0) => {
      const scheduleReconnect = (retryFrom: number, errorMessage?: string) => {
        if (errorMessage) {
          setErrorText(errorMessage);
        }
        ensureRoomPolling(activeRoomId);
        const nextRetry = Math.min(10000, 1000 * Math.max(1, retryFrom + 1));
        clearRoomStreamRetry();
        roomStreamRetryRef.current = setTimeout(() => {
          if (cancelled) return;
          void bindStream(retryFrom + 1);
        }, nextRetry);
      };

      let cleanup: () => void;
	      try {
	        cleanup = await connectChatStream(activeRoomId, {
	          onEvent: (event) => {
	            if (cancelled) return;
	            if (event.type === 'ready') {
	              clearRoomPolling();
	              setErrorText('');
	              return;
	            }
	            if (event.type === 'message' || event.type === 'invite' || event.type === 'room_status') {
	              if (event.type === 'room_status') {
	                showRoomStatusNotice(event);
	              }
	              void refreshRoomSafely(activeRoomId);
	            }
	          },
          onError: (streamError) => {
            if (cancelled) return;
            if (isTerminalStreamError(streamError)) {
              clearRoomStreamRetry();
              clearRoomPolling();
              setErrorText(streamError.message || t('chat.message.streamTerminalError'));
              return;
            }
            scheduleReconnect(retryCount, streamError.message || t('chat.message.streamFail'));
          },
        onClose: () => {
          if (cancelled) return;
          scheduleReconnect(retryCount, t('chat.message.streamClosedRetry'));
        },
        });
      } catch (error) {
        if (cancelled) return;
        scheduleReconnect(retryCount, getErrorMessage(error, 'chat.message.streamFail'));
        return;
      }
      if (cancelled) {
        cleanup();
        return;
      }
      roomStreamCleanupRef.current = cleanup;
    };

    void bindStream();
    return () => {
      cancelled = true;
      clearRoomStreamRetry();
      roomStreamCleanupRef.current?.();
      roomStreamCleanupRef.current = null;
    };
	  }, [clearRoomPolling, clearRoomStreamRetry, ensureRoomPolling, isTerminalStreamError, refreshRoomSafely, room?.id, showRoomStatusNotice]);

  useEffect(() => {
    // 新訊息進來時：
    // - 若使用者已在底部（或接近底部），自動捲到底
    // - 否則標記 unread，提供「跳到最新」操作
    if (!routeRoomId) return;
    const nextCount = messages.length;
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = nextCount;
    if (nextCount === 0) return;
    if (nextCount <= prevCount) return;

    if (!isAtBottomRef.current) {
      setHasUnread(true);
    }
  }, [messages, routeRoomId]);

  const loadMoreHistory = useCallback(async () => {
    if (!room?.id) return;
    if (!hasMoreHistory) return;
    if (!historyCursor) return;
    if (loadingMoreHistory) return;
    if (loadMoreHistoryLockRef.current) return;

    if (!pendingAnchorMessageId && messagesRef.current.length >= MAX_MESSAGE_CACHE) {
      const now = Date.now();
      if (now - historyCacheFullNoticeAtRef.current > 5000) {
        historyCacheFullNoticeAtRef.current = now;
        message.info(t('chat.message.historyCacheFull'));
      }
      return;
    }

    loadMoreHistoryLockRef.current = true;
    setLoadingMoreHistory(true);

    try {
      const result = await listChatMessages(room.id, { cursor: historyCursor, limit: 50 });
      if (result.messages.length === 0) {
        setHasMoreHistory(false);
        return;
      }
      const uniqueNew = result.messages.filter((m) => !messageIndexByIdRef.current.has(m.id));
      if (uniqueNew.length > 0) {
        setFirstItemIndex((prev) => Math.max(0, prev - uniqueNew.length));
      }
      setMessages((prev) => mergeSortedMessages(uniqueNew, prev));
      setHistoryCursor(result.nextCursor);
      setHasMoreHistory(!!result.nextCursor);

    } catch (error) {
      message.error(getErrorMessage(error, 'chat.message.loadMoreFail'));
    } finally {
      setLoadingMoreHistory(false);
      loadMoreHistoryLockRef.current = false;
    }
  }, [hasMoreHistory, historyCursor, loadingMoreHistory, mergeSortedMessages, pendingAnchorMessageId, room?.id]);

  const setMessageAnchor = useCallback((messageId: string, opts?: { replace?: boolean }) => {
    try {
      if (typeof window === 'undefined') return;
      const nextHash = `#msg-${messageId}`;
      if (opts?.replace) {
        const url = new URL(window.location.href);
        url.hash = nextHash;
        window.history.replaceState(null, '', url.toString());
        return;
      }
      window.location.hash = `msg-${messageId}`;
    } catch {
      // ignore
    }
  }, []);

  const parseAnchorMessageId = useCallback((): string | null => {
    try {
      const raw = window.location.hash || '';
      const match = raw.match(/^#?msg-(.+)$/);
      return match?.[1] ?? null;
    } catch {
      return null;
    }
  }, []);

  const handleAnchorTarget = useCallback((targetId: string) => {
    if (!room?.id) return;
    const key = `${room.id}:${targetId}`;
    if (pendingAnchorHandledRef.current === key) {
      if (messageIndexByIdRef.current.has(targetId)) {
        scrollToMessage(targetId);
      }
      return;
    }
    pendingAnchorHandledRef.current = key;
    anchorAutoPagesRef.current = 0;

    if (!anchorJumpOriginRef.current) {
      const localStartIndex = rangeStartIndexRef.current - firstItemIndexRef.current;
      const safeIndex = Math.min(
        Math.max(localStartIndex, 0),
        Math.max(0, messagesRef.current.length - 1)
      );
      const originMessageId = messagesRef.current[safeIndex]?.id ?? null;
      anchorJumpOriginRef.current = {
        originMessageId,
        wasAtBottom: isAtBottomRef.current,
      };
    }

    if (messageIndexByIdRef.current.has(targetId)) {
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
  }, [room?.id, scrollToMessage]);

  useEffect(() => {
    if (!room?.id) return;
    const targetId = parseAnchorMessageId();
    if (!targetId) return;
    handleAnchorTarget(targetId);
  }, [handleAnchorTarget, parseAnchorMessageId, room?.id]);

  useEffect(() => {
    if (!room?.id) return;
    const onHashChange = () => {
      const targetId = parseAnchorMessageId();
      if (!targetId) return;
      handleAnchorTarget(targetId);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [handleAnchorTarget, parseAnchorMessageId, room?.id]);

  useEffect(() => {
    if (!room?.id) return;
    if (!pendingAnchorMessageId) return;
    if (messageIndexByIdRef.current.has(pendingAnchorMessageId)) {
      const origin = anchorJumpOriginRef.current;
      if (origin) {
        setJumpBackState(origin);
        anchorJumpOriginRef.current = null;
      }
      scrollToMessage(pendingAnchorMessageId);
      setPendingAnchorMessageId(null);
      return;
    }
    if (!hasMoreHistory || loadingMoreHistory) return;
    if (!historyCursor) {
      message.info(t('chat.message.referenceNotLoaded'));
      setPendingAnchorMessageId(null);
      anchorJumpOriginRef.current = null;
      return;
    }

    // Cap auto paging to avoid excessive loading.
    if (anchorAutoPagesRef.current >= ANCHOR_AUTO_PAGE_LIMIT) {
      message.info(t('chat.message.referenceNotLoaded'));
      setPendingAnchorMessageId(null);
      anchorJumpOriginRef.current = null;
      return;
    }
    anchorAutoPagesRef.current += 1;
    void loadMoreHistory();
  }, [hasMoreHistory, historyCursor, loadMoreHistory, loadingMoreHistory, pendingAnchorMessageId, room?.id, scrollToMessage]);

  useEffect(() => {
    if (!room?.id) return;
    if (room.status === 'judgment_requested') {
      setJudging(true);
      if (judgmentPollingRoomIdRef.current !== room.id || !judgmentPollingRef.current) {
        tryStartJudgmentPolling(room.id);
      }
      return;
    }
    if (room.status === 'judgment_completed' || room.status === 'judgment_failed') {
      setJudging(false);
      requestJudgmentLockRef.current = false;
      clearJudgmentPolling();
    }
  }, [clearJudgmentPolling, room?.id, room?.status, tryStartJudgmentPolling]);

  const handleCreateRoom = useCallback(async () => {
    if (createRoomLockRef.current) return;
    createRoomLockRef.current = true;
    setCreatingRoom(true);
    setErrorText('');
    try {
      const created = await createChatRoom(visibilityMode);
      if (!mountedRef.current) return;
      setRoom(created);
      setLastInviteCode('');
      navigate(`/chat/room/${created.id}`, { state: { room: created } });
    } catch (error) {
      if (!mountedRef.current) return;
      setErrorText(getErrorMessage(error, 'chat.message.createRoomFail'));
    } finally {
      if (mountedRef.current) {
        setCreatingRoom(false);
      }
      createRoomLockRef.current = false;
    }
  }, [mountedRef, navigate, visibilityMode]);

  const handleAcceptInvite = useCallback(async () => {
    if (decliningInvite || declineInviteLockRef.current) return;
    const inviteCode = inviteCodeInput.trim();
    if (!inviteCode) {
      message.warning(t('chat.message.inviteCodeRequired'));
      return;
    }
    if (joinInviteLockRef.current) return;
    joinInviteLockRef.current = true;
    setJoiningInvite(true);
    try {
      const joined = await acceptChatInvite(inviteCode);
      if (!mountedRef.current) return;
      setErrorText('');
      message.success(t('chat.message.joinSuccess'));
      navigate(`/chat/room/${joined.id}`);
    } catch (error) {
      if (!mountedRef.current) return;
      message.error(getErrorMessage(error, 'chat.message.joinFail'));
    } finally {
      if (mountedRef.current) {
        setJoiningInvite(false);
      }
      joinInviteLockRef.current = false;
    }
  }, [decliningInvite, inviteCodeInput, mountedRef, navigate]);

  const handleDeclineInvite = useCallback(async () => {
    if (joiningInvite || joinInviteLockRef.current) return;
    const inviteCode = inviteCodeInput.trim();
    if (!inviteCode) {
      message.warning(t('chat.message.inviteCodeRequired'));
      return;
    }
    if (declineInviteLockRef.current) return;
    declineInviteLockRef.current = true;
    setDecliningInvite(true);
    try {
      await declineChatInvite(inviteCode);
      if (!mountedRef.current) return;
      setErrorText('');
      message.success(t('chat.message.declineSuccess'));
    } catch (error) {
      if (!mountedRef.current) return;
      message.error(getErrorMessage(error, 'chat.message.declineFail'));
    } finally {
      if (mountedRef.current) {
        setDecliningInvite(false);
      }
      declineInviteLockRef.current = false;
    }
  }, [inviteCodeInput, joiningInvite, mountedRef]);

  const handleSendMessage = useCallback(async () => {
    if (!room?.id) return;
    if (sendMessageLockRef.current) return;
    if (room.status === 'judgment_requested' || isRoomTerminalStatus(room.status)) return;
    const content = messageInput.trim();
    if (!content) return;
    sendMessageLockRef.current = true;
    setSending(true);
    try {
      const sent = await sendChatMessage(room.id, {
        content,
        visibility_scope: visibilityScope,
        reply_to_message_id: replyTo?.id,
      });
      if (!mountedRef.current) return;
      setMessages((prev) => {
        const next = [...prev, sent];
        const allowTrim = isAtBottomRef.current && !pendingAnchorMessageId && !loadingMoreHistory;
        return trimMessageCache(next, { allowTrim });
      });
      if (visibilityScope === 'all') {
        clearThinkingTimeout();
        setAIDraft({
          streamId: null,
          requestId: null,
          text: '',
          status: 'thinking',
        });
        thinkingTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setAIDraft(null);
          }
          thinkingTimeoutRef.current = null;
        }, AI_THINKING_TIMEOUT_MS);
      }
      setMessageInput('');
      setReplyTo(null);
      setErrorText('');
    } catch (error) {
      if (!mountedRef.current) return;
      const err = error as { message?: string; code?: string };
      if (err.code === 'FORBIDDEN') {
        message.warning(t('chat.message.forbidden'));
      } else {
        message.error(getErrorMessage(error, 'chat.message.sendFail'));
      }
    } finally {
      if (mountedRef.current) {
        setSending(false);
      }
      sendMessageLockRef.current = false;
    }
  }, [clearThinkingTimeout, isRoomTerminalStatus, loadingMoreHistory, messageInput, mountedRef, pendingAnchorMessageId, replyTo?.id, room?.id, room?.status, trimMessageCache, visibilityScope]);

  const handleCreateInvite = useCallback(async () => {
    if (!room?.id) return;
    if (createInviteLockRef.current) return;
    if (room.status === 'judgment_requested' || isRoomTerminalStatus(room.status)) return;
    createInviteLockRef.current = true;
    setCreatingInvite(true);
    try {
      // Invite visibility should follow room settings; avoid leaking stale UI state.
      const invite = await createChatInvite(room.id, { history_visibility_mode: room.history_visibility_mode ?? 'share_summary_only' });
      if (!mountedRef.current) return;
      setLastInviteCode(invite.invite_code || '');
      setErrorText('');
      await refreshRoomSafely(room.id);
      if (!mountedRef.current) return;
      message.success(t('chat.message.createInviteSuccess'));
    } catch (error) {
      if (!mountedRef.current) return;
      const err = error as { message?: string; code?: string };
      if (err.code === 'CONFLICT') {
        message.warning(t('chat.message.conflictRefresh'));
        await refreshRoomSafely(room.id).catch(() => undefined);
        return;
      }
      if (err.code === 'INVALID_SESSION_ID' || err.code === 'SESSION_EXPIRED') {
        message.warning(t('chat.message.invalidSession'));
        return;
      }
      message.error(getErrorMessage(error, 'chat.message.createInviteFail'));
    } finally {
      if (mountedRef.current) {
        setCreatingInvite(false);
      }
      createInviteLockRef.current = false;
    }
  }, [isRoomTerminalStatus, mountedRef, refreshRoomSafely, room?.history_visibility_mode, room?.id, room?.status]);

  const openJudgmentPreview = useCallback(() => {
    if (!room?.id) return;
    if (room.status === 'judgment_requested' || isRoomTerminalStatus(room.status)) return;
    const included = getJudgmentPreviewInfo(room, messages).includedMessages.map((m) => m.id);
    setSelectedForJudgment(included);
    setPreviewVisible(true);
  }, [messages, room, isRoomTerminalStatus]);

  const handleJumpBack = useCallback(() => {
    const origin = jumpBackState;
    setJumpBackState(null);
    if (!origin) return;
    if (origin.wasAtBottom) {
      scrollToBottom('smooth');
      return;
    }
    if (origin.originMessageId) {
      const idx = messageIndexByIdRef.current.get(origin.originMessageId);
      if (idx !== undefined) {
        virtuosoRef.current?.scrollToIndex({ index: idx, align: 'start', behavior: 'smooth' });
      }
    }
  }, [jumpBackState, scrollToBottom]);

  const handleLeaveRoomAction = useCallback(async () => {
    if (!room?.id) return;
    try {
      await leaveChatRoom(room.id);
      if (!mountedRef.current) return;
      message.success(t('chat.message.leaveRoomSuccess'));
      navigate('/chat/room');
    } catch (error) {
      if (!mountedRef.current) return;
      message.error(getErrorMessage(error, 'chat.message.leaveRoomFail'));
    }
  }, [mountedRef, navigate, room?.id]);

  const handleKickB = useCallback(async () => {
    if (!room?.id) return;
    try {
      await kickChatParticipantB(room.id);
      if (!mountedRef.current) return;
      message.success(t('chat.message.kickSuccess'));
      await refreshRoomSafely(room.id);
    } catch (error) {
      if (!mountedRef.current) return;
      message.error(getErrorMessage(error, 'chat.message.kickFail'));
    }
  }, [mountedRef, refreshRoomSafely, room?.id]);

  const handleRequestJudgment = useCallback(async (includedIds?: string[]) => {
    if (!room?.id) return;
    if (requestJudgmentLockRef.current) return;
    if (room.status === 'judgment_requested' || isRoomTerminalStatus(room.status)) return;
    requestJudgmentLockRef.current = true;
    setJudging(true);
    try {
      const payload = includedIds && includedIds.length > 0 ? { included_message_ids: includedIds } : undefined;
      const result = await requestChatJudgment(room.id, payload);
      if (!mountedRef.current) return;
      setErrorText('');
      message.success(t('chat.message.judgmentRequested'));
      if (result.judgmentId) {
        navigate(`/judgment/${result.judgmentId}`);
        return;
      }
      tryStartJudgmentPolling(room.id);
      await refreshRoomSafely(room.id);
    } catch (error) {
      if (!mountedRef.current) return;
      const err = error as { message?: string; code?: string };
      if (err.code === 'CONFLICT') {
        message.warning(t('chat.message.conflictRefresh'));
        await refreshRoomSafely(room.id).catch(() => undefined);
      } else if (err.code === 'INVALID_SESSION_ID' || err.code === 'SESSION_EXPIRED') {
        message.warning(t('chat.message.invalidSession'));
      } else {
        message.error(getErrorMessage(error, 'chat.message.judgmentFail'));
      }
    } finally {
      if (mountedRef.current) {
        setJudging(false);
      }
      requestJudgmentLockRef.current = false;
    }
  }, [isRoomTerminalStatus, mountedRef, navigate, refreshRoomSafely, room?.id, room?.status, tryStartJudgmentPolling]);

  const roomStatus = room?.status;
  const isRoomTerminal = isRoomTerminalStatus(roomStatus);
  const sessionId = sessionStorage.get();
  const isOwner =
    (room?.owner_user_id && currentUserId && room.owner_user_id === currentUserId) ||
    (room?.session_id && sessionId && room.session_id === sessionId);
  const hasActiveRoleB = !!room?.participants?.some((p) => p.role_in_room === 'roleB' && p.is_active);
  const disableSendMessage = !room?.id || sending || isRoomTerminal || roomStatus === 'judgment_requested';
  const disableCreateInvite =
    !room?.id ||
    creatingInvite ||
    isRoomTerminal ||
    roomStatus === 'judgment_requested' ||
    !isOwner ||
    hasActiveRoleB;
  const disableRequestJudgment =
    !room?.id ||
    judging ||
    isRoomTerminal ||
    roomStatus === 'judgment_requested' ||
    !isOwner;
  const myActiveParticipant = useMemo(() => {
    if (!room?.participants) return null;
    if (!currentUserId) return null;
    return room.participants.find((p) => p.user_id === currentUserId && p.is_active) ?? null;
  }, [currentUserId, room?.participants]);
  const myRole = myActiveParticipant?.role_in_room ?? (isOwner ? 'roleA' : null);
  const canKickB = isOwner && hasActiveRoleB;
  const canLeaveRoom = myRole === 'roleB';
  const messageById = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    messages.forEach((m) => map.set(m.id, m));
    return map;
  }, [messages]);

  const previewInfo = useMemo(() => getJudgmentPreviewInfo(room, messages), [messages, room]);

  const canRequestMoreHistory = hasMoreHistory && !!historyCursor && messages.length > 0;
  const historyBlockedByCache = canRequestMoreHistory && !pendingAnchorMessageId && messages.length >= MAX_MESSAGE_CACHE;
  const canLoadMoreHistory = canRequestMoreHistory && !historyBlockedByCache;

  const latestSafetyNotice = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const candidate = messages[i];
      if (candidate?.message_type === 'safety_notice') return candidate;
    }
    return null;
  }, [messages]);

  const currentHrefWithoutHash = useMemo(() => {
    try {
      const url = new URL(window.location.href);
      url.hash = '';
      return url.toString();
    } catch {
      return '';
    }
  }, [routeRoomId]);

  if (!routeRoomId) {
    return (
      <ChatRoomEntrySection
        errorText={errorText}
        visibilityMode={visibilityMode}
        onVisibilityModeChange={setVisibilityMode}
        inviteCodeInput={inviteCodeInput}
        onInviteCodeInputChange={(v) => setInviteCodeInput(v)}
        creatingRoom={creatingRoom}
        joiningInvite={joiningInvite}
        decliningInvite={decliningInvite}
        onCreateRoom={handleCreateRoom}
        onAcceptInvite={handleAcceptInvite}
        onDeclineInvite={handleDeclineInvite}
      />
    );
  }

  return (
    <div className="chat-room-page">
      <Card className="chat-room-page__panel">
        {loading ? (
          <div className="chat-room-page__loading">
            <Spin />
          </div>
        ) : (
          <>
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <ChatRoomHeader
                roomId={routeRoomId!}
                room={room}
                myRole={myRole}
                isOwner={!!isOwner}
                hasActiveRoleB={!!hasActiveRoleB}
                getRoleLabel={getRoleLabel}
                disableCreateInvite={disableCreateInvite}
                disableRequestJudgment={disableRequestJudgment}
                creatingInvite={creatingInvite}
                judging={judging}
                canLeaveRoom={!!canLeaveRoom}
                canKickB={!!canKickB}
                onCreateInvite={handleCreateInvite}
                onRequestJudgment={openJudgmentPreview}
                onLeaveRoomAction={handleLeaveRoomAction}
                onKickB={handleKickB}
                onNavigateBack={() => navigate('/chat/room')}
              />
              <ChatRoomAlerts
                errorText={errorText}
                lastInviteCode={lastInviteCode}
                latestSafetyContent={latestSafetyNotice?.content ?? null}
                hasRoom={!!room}
                roomId={routeRoomId}
                onRetryLoad={handleRetryLoad}
              />
              <ChatMessageList
                messages={messages}
                firstItemIndex={firstItemIndex}
                virtuosoRef={virtuosoRef}
                messagesContainerRef={messagesContainerRef}
                onRangeChanged={(range) => { rangeStartIndexRef.current = range.startIndex; }}
                onAtBottomChange={(atBottom) => {
                  isAtBottomRef.current = atBottom;
                  if (atBottom) setHasUnread(false);
                }}
                onStartReached={() => {
                  if (pendingAnchorMessageId) return;
                  if (!canLoadMoreHistory) return;
                  if (loadingMoreHistory) return;
                  void loadMoreHistory();
                }}
                canRequestMoreHistory={canRequestMoreHistory}
                canLoadMoreHistory={canLoadMoreHistory}
                loadingMoreHistory={loadingMoreHistory}
                historyBlockedByCache={historyBlockedByCache}
                onLoadMoreHistory={loadMoreHistory}
                aiDraft={aiDraft}
                currentHrefWithoutHash={currentHrefWithoutHash}
                messageById={messageById}
                replyTo={replyTo}
                highlightMessageId={highlightMessageId}
                disableSendMessage={disableSendMessage}
                setMessageAnchor={setMessageAnchor}
                handleAnchorTarget={handleAnchorTarget}
                getRoleLabel={getRoleLabel}
                getVisibilityScopeLabel={getVisibilityScopeLabel}
                getMessageTypeLabel={getMessageTypeLabel}
                getAiStrategyLabel={getAiStrategyLabel}
                setReplyTo={setReplyTo}
                hasUnread={hasUnread}
                jumpBackState={jumpBackState}
                onJumpBack={handleJumpBack}
                onDismissJumpBack={() => setJumpBackState(null)}
                onJumpToLatest={() => scrollToBottom('smooth')}
              />
              <ChatMessageComposer
                visibilityScope={visibilityScope}
                onVisibilityScopeChange={setVisibilityScope}
                messageInput={messageInput}
                onMessageInputChange={setMessageInput}
                replyTo={replyTo}
                onClearReply={() => setReplyTo(null)}
                disableSend={disableSendMessage}
                sending={sending}
                onSend={handleSendMessage}
              />
            </Space>
          </>
        )}
      </Card>

      <ChatJudgmentPanel
        open={previewVisible}
        previewInfo={previewInfo}
        selectedForJudgment={selectedForJudgment}
        onSelectedChange={setSelectedForJudgment}
        judging={judging}
        getRoleLabel={getRoleLabel}
        onCancel={() => {
          setPreviewVisible(false);
          setJudging(false);
          requestJudgmentLockRef.current = false;
        }}
        onConfirm={handleRequestJudgment}
      />
    </div>
  );
};

export default ChatRoomPage;
