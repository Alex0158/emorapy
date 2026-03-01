import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, LinkOutlined, RollbackOutlined } from '@ant-design/icons';
import { t } from '@/utils/i18n';
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
import { copyToClipboard } from '@/utils/copyToClipboard';
import { sessionStorage } from '@/utils/storage';
import { Virtuoso, type ListRange, type VirtuosoHandle } from 'react-virtuoso';
import './index.less';

const { Title, Text, Paragraph } = Typography;

const MAX_MESSAGE_CACHE = 600;
const ANCHOR_AUTO_PAGE_LIMIT = 6;
const INITIAL_FIRST_ITEM_INDEX = 100_000;

const ROOM_STATUS_COLOR: Partial<Record<ChatRoomStatus, string>> = {
  solo_active: 'blue',
  invite_pending: 'gold',
  invite_accepted: 'cyan',
  group_active: 'green',
  judgment_requested: 'orange',
  judgment_completed: 'success',
  judgment_failed: 'error',
  archived: 'default',
};

const ChatRoomPage = () => {
  const navigate = useNavigate();
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

  const judgmentPollingRef = useRef<number | null>(null);
  const judgmentPollingAttemptsRef = useRef(0);
  const judgmentPollingRoomIdRef = useRef<string | null>(null);
  const roomPollingRef = useRef<number | null>(null);
  const streamCleanupRef = useRef<(() => void) | null>(null);
  const streamRetryRef = useRef<number | null>(null);
  const roomRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const roomRefreshQueuedRef = useRef(false);
  const createRoomLockRef = useRef(false);
  const joinInviteLockRef = useRef(false);
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

  const clearStreamRetry = useCallback(() => {
    if (streamRetryRef.current) {
      clearTimeout(streamRetryRef.current);
      streamRetryRef.current = null;
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

  const isRoomTerminalStatus = useCallback((status?: ChatRoomStatus) => {
    return status === 'judgment_completed' || status === 'judgment_failed' || status === 'archived';
  }, []);

  const showRoomStatusNotice = useCallback((event: { at?: string; payload?: Record<string, unknown> }) => {
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
  }, []);

  const getRoleLabel = useCallback((role: string | null | undefined) => {
    const r = role ?? 'unknown';
    if (r === 'roleA') return t('chat.role.roleA');
    if (r === 'roleB') return t('chat.role.roleB');
    if (r === 'aiMediator') return t('chat.role.aiMediator');
    if (r === 'system') return t('chat.role.system');
    return t('chat.role.unknown');
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

  const ensureRoomPolling = useCallback((targetRoomId: string) => {
    if (roomPollingRef.current) return;
    roomPollingRef.current = setInterval(() => {
      refreshRoomSafely(targetRoomId).catch(() => undefined);
    }, 8000);
  }, [refreshRoomSafely]);

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
        pendingAnchorHandledRef.current = null;
        anchorJumpOriginRef.current = null;
        anchorAutoPagesRef.current = 0;
        clearRoomPolling();
        clearJudgmentPolling();
        streamCleanupRef.current?.();
        streamCleanupRef.current = null;
        clearStreamRetry();
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
      setLoading(true);
      setErrorText('');
      try {
        await loadRoomInitial(routeRoomId);
        if (!cancelled) {
          clearRoomPolling();
          ensureRoomPolling(routeRoomId);
          // 初次進入房間：若帶有訊息錨點（#msg-...），優先讓錨點邏輯接管定位；
          // 否則直接置底，避免使用者一開始看到中段訊息。
          const hasAnchor = (() => {
            try { return typeof window.location.hash === 'string' && window.location.hash.startsWith('#msg-'); } catch { return false; }
          })();
          if (!hasAnchor) {
            setTimeout(() => scrollToBottom('auto'), 0);
          }
        }
      } catch (error) {
        const err = error as { message?: string };
        if (!cancelled) {
          setErrorText(err.message || t('chat.message.loadFail'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void init();
    return () => {
      cancelled = true;
      clearRoomPolling();
      clearJudgmentPolling();
      streamCleanupRef.current?.();
      streamCleanupRef.current = null;
      clearStreamRetry();
      clearHighlightTimer();
    };
  }, [routeRoomId, clearJudgmentPolling, clearRoomPolling, loadRoomInitial, ensureRoomPolling, clearStreamRetry, clearHighlightTimer, scrollToBottom]);

  useEffect(() => {
    if (!routeRoomId) return;
    let cancelled = false;
    streamCleanupRef.current?.();
    streamCleanupRef.current = null;
    clearStreamRetry();

    const bindStream = async (retryCount = 0) => {
      const scheduleReconnect = (retryFrom: number, errorMessage?: string) => {
        if (errorMessage) {
          setErrorText(errorMessage);
        }
        ensureRoomPolling(routeRoomId);
        const nextRetry = Math.min(10000, 1000 * Math.max(1, retryFrom + 1));
        clearStreamRetry();
        streamRetryRef.current = setTimeout(() => {
          if (cancelled) return;
          void bindStream(retryFrom + 1);
        }, nextRetry);
      };

      let cleanup: () => void;
	      try {
	        cleanup = await connectChatStream(routeRoomId, {
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
	              void refreshRoomSafely(routeRoomId);
	            }
	          },
          onError: (streamError) => {
            if (cancelled) return;
            if (isTerminalStreamError(streamError)) {
              clearStreamRetry();
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
        const err = error as { message?: string };
        scheduleReconnect(retryCount, err.message || t('chat.message.streamFail'));
        return;
      }
      if (cancelled) {
        cleanup();
        return;
      }
      streamCleanupRef.current = cleanup;
    };

    void bindStream();
    return () => {
      cancelled = true;
      clearStreamRetry();
      streamCleanupRef.current?.();
      streamCleanupRef.current = null;
    };
	  }, [clearRoomPolling, clearStreamRetry, ensureRoomPolling, isTerminalStreamError, refreshRoomSafely, routeRoomId, showRoomStatusNotice]);

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
      const err = error as { message?: string };
      message.error(err.message || t('chat.message.loadMoreFail'));
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
      setRoom(created);
      setLastInviteCode('');
      navigate(`/chat/room/${created.id}`);
    } catch (error) {
      const err = error as { message?: string };
      setErrorText(err.message || t('chat.message.createRoomFail'));
    } finally {
      setCreatingRoom(false);
      createRoomLockRef.current = false;
    }
  }, [navigate, visibilityMode]);

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
      setErrorText('');
      message.success(t('chat.message.joinSuccess'));
      navigate(`/chat/room/${joined.id}`);
    } catch (error) {
      const err = error as { message?: string };
      message.error(err.message || t('chat.message.joinFail'));
    } finally {
      setJoiningInvite(false);
      joinInviteLockRef.current = false;
    }
  }, [decliningInvite, inviteCodeInput, navigate]);

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
      setErrorText('');
      message.success(t('chat.message.declineSuccess'));
    } catch (error) {
      const err = error as { message?: string };
      message.error(err.message || t('chat.message.declineFail'));
    } finally {
      setDecliningInvite(false);
      declineInviteLockRef.current = false;
    }
  }, [inviteCodeInput, joiningInvite]);

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
      setMessages((prev) => {
        const next = [...prev, sent];
        const allowTrim = isAtBottomRef.current && !pendingAnchorMessageId && !loadingMoreHistory;
        return trimMessageCache(next, { allowTrim });
      });
      setMessageInput('');
      setReplyTo(null);
      setErrorText('');
    } catch (error) {
      const err = error as { message?: string; code?: string };
      if (err.code === 'FORBIDDEN') {
        message.warning(t('chat.message.forbidden'));
      } else {
        message.error(err.message || t('chat.message.sendFail'));
      }
    } finally {
      setSending(false);
      sendMessageLockRef.current = false;
    }
  }, [isRoomTerminalStatus, loadingMoreHistory, messageInput, pendingAnchorMessageId, replyTo?.id, room?.id, room?.status, trimMessageCache, visibilityScope]);

  const handleCreateInvite = useCallback(async () => {
    if (!room?.id) return;
    if (createInviteLockRef.current) return;
    if (room.status === 'judgment_requested' || isRoomTerminalStatus(room.status)) return;
    createInviteLockRef.current = true;
    setCreatingInvite(true);
    try {
      // Invite visibility should follow room settings; avoid leaking stale UI state.
      const invite = await createChatInvite(room.id, { history_visibility_mode: room.history_visibility_mode ?? 'share_summary_only' });
      setLastInviteCode(invite.invite_code || '');
      setErrorText('');
      await refreshRoomSafely(room.id);
      message.success(t('chat.message.createInviteSuccess'));
    } catch (error) {
      const err = error as { message?: string; code?: string };
      if (err.code === 'CONFLICT') {
        message.warning(t('chat.message.conflictRefresh'));
        await refreshRoomSafely(room.id).catch(() => undefined);
        return;
      }
      message.error(err.message || t('chat.message.createInviteFail'));
    } finally {
      setCreatingInvite(false);
      createInviteLockRef.current = false;
    }
  }, [isRoomTerminalStatus, refreshRoomSafely, room?.history_visibility_mode, room?.id, room?.status]);

  const openJudgmentPreview = useCallback(() => {
    if (!room?.id) return;
    if (room.status === 'judgment_requested' || isRoomTerminalStatus(room.status)) return;
    const included = getJudgmentPreviewInfo(room, messages).includedMessages.map((m) => m.id);
    setSelectedForJudgment(included);
    setPreviewVisible(true);
  }, [messages, room, isRoomTerminalStatus]);

  const handleRequestJudgment = useCallback(async (includedIds?: string[]) => {
    if (!room?.id) return;
    if (requestJudgmentLockRef.current) return;
    if (room.status === 'judgment_requested' || isRoomTerminalStatus(room.status)) return;
    requestJudgmentLockRef.current = true;
    setJudging(true);
    try {
      const payload = includedIds && includedIds.length > 0 ? { included_message_ids: includedIds } : undefined;
      const result = await requestChatJudgment(room.id, payload);
      setErrorText('');
      message.success(t('chat.message.judgmentRequested'));
      if (result.judgmentId) {
        navigate(`/judgment/${result.judgmentId}`);
        return;
      }
      tryStartJudgmentPolling(room.id);
      await refreshRoomSafely(room.id);
    } catch (error) {
      const err = error as { message?: string; code?: string };
      if (err.code === 'CONFLICT') {
        message.warning(t('chat.message.conflictRefresh'));
        await refreshRoomSafely(room.id).catch(() => undefined);
      } else if (err.code === 'INVALID_SESSION_ID') {
        message.warning(t('chat.message.invalidSession'));
      } else {
        message.error(err.message || t('chat.message.judgmentFail'));
      }
    } finally {
      setJudging(false);
      requestJudgmentLockRef.current = false;
    }
  }, [isRoomTerminalStatus, navigate, refreshRoomSafely, room?.id, room?.status, tryStartJudgmentPolling]);

  const statusTag = useMemo(() => {
    if (!room?.status) return null;
    return (
      <Tag color={ROOM_STATUS_COLOR[room.status] || 'default'}>
        {t(`chat.status.${room.status}`)}
      </Tag>
    );
  }, [room?.status]);

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
  const previewList = previewInfo.includedMessages;
  const previewMessage = previewList.length === 0
    ? t('chat.preview.none')
    : previewList
      .map((m) => `${new Date(m.created_at).toLocaleString()} | ${getRoleLabel(m.sender_participant?.role_in_room)}: ${m.content}`)
      .join('\n');

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
      <div className="chat-room-page">
        <Card className="chat-room-page__panel">
          <Title level={3}>{t('chat.title')}</Title>
          <Paragraph type="secondary">{t('chat.subtitle')}</Paragraph>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Select
              value={visibilityMode}
              onChange={(value) => setVisibilityMode(value)}
              options={[
                { value: 'share_full_history', label: t('chat.visibility.share_full_history') },
                { value: 'share_summary_only', label: t('chat.visibility.share_summary_only') },
                { value: 'share_from_join_time', label: t('chat.visibility.share_from_join_time') },
              ]}
            />
            <Button type="primary" loading={creatingRoom} onClick={handleCreateRoom}>
              {t('chat.createRoom')}
            </Button>
            <Input
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value)}
              placeholder={t('chat.inviteCodePlaceholder')}
            />
            <Button loading={joiningInvite} onClick={handleAcceptInvite}>
              {t('chat.joinByInvite')}
            </Button>
            <Button loading={decliningInvite} onClick={handleDeclineInvite}>
              {t('chat.declineInvite')}
            </Button>
            {errorText ? <Alert type="error" title={errorText} showIcon /> : null}
          </Space>
        </Card>
      </div>
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
	              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
	                <Title level={4} style={{ margin: 0 }}>
	                  {t('chat.roomLabel').replace('{roomId}', room?.id || routeRoomId)}
	                </Title>
	                {statusTag}
	              </Space>
              {myRole ? (
                <Text type="secondary">
                  {t('chat.myRoleLabel')}
                  {getRoleLabel(myRole)}
                </Text>
              ) : null}
	              {errorText ? <Alert type="error" showIcon title={errorText} /> : null}
	              {lastInviteCode ? (
	                <Alert
	                  type="success"
	                  showIcon
	                  title={t('chat.inviteCodeLabel').replace('{code}', lastInviteCode)}
	                />
	              ) : null}
	              {latestSafetyNotice ? (
	                <Alert
	                  className="chat-room-page__safety-banner"
	                  type="warning"
	                  showIcon
	                  title={t('chat.safetyBannerTitle')}
	                  description={latestSafetyNotice.content}
	                />
	              ) : null}
	              <Space wrap>
	                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/chat/room')}>
	                  {t('chat.leaveRoom')}
	                </Button>
	                <Button disabled={disableCreateInvite} loading={creatingInvite} onClick={handleCreateInvite}>
	                  {t('chat.createInvite')}
	                </Button>
	                <Button type="primary" disabled={disableRequestJudgment} loading={judging} onClick={openJudgmentPreview}>
	                  {t('chat.requestJudgment')}
	                </Button>
	                {canLeaveRoom ? (
	                  <Button
	                    onClick={async () => {
	                      if (!room?.id) return;
	                      try {
	                        await leaveChatRoom(room.id);
	                        message.success(t('chat.message.leaveRoomSuccess'));
	                        navigate('/chat/room');
	                      } catch (error) {
	                        const err = error as { message?: string };
	                        message.error(err.message || t('chat.message.leaveRoomFail'));
	                      }
	                    }}
	                  >
	                    {t('chat.leaveRoomAction')}
	                  </Button>
	                ) : null}
	                {canKickB ? (
	                  <Button
	                    danger
	                    onClick={async () => {
	                      if (!room?.id) return;
	                      try {
	                        await kickChatParticipantB(room.id);
	                        message.success(t('chat.message.kickSuccess'));
	                        await refreshRoomSafely(room.id);
	                      } catch (error) {
	                        const err = error as { message?: string };
	                        message.error(err.message || t('chat.message.kickFail'));
	                      }
	                    }}
	                  >
	                    {t('chat.kickB')}
	                  </Button>
	                ) : null}
	              </Space>
	              {!isOwner ? (
	                <Text type="secondary">{t('chat.hint.onlyOwnerActions')}</Text>
	              ) : hasActiveRoleB ? (
	                <Text type="secondary">{t('chat.hint.roleBAlreadyJoined')}</Text>
	              ) : null}
	            </Space>

	            <div className="chat-room-page__messages">
	              {messages.length === 0 ? (
	                <div className="chat-room-page__messages-empty">
	                  <Text type="secondary">{t('chat.emptyMessages')}</Text>
	                </div>
	              ) : (
	                <>
	                  <Virtuoso
	                    ref={virtuosoRef}
	                    className="chat-room-page__virtuoso"
	                    style={{ height: '100%' }}
	                    data={messages}
	                    firstItemIndex={firstItemIndex}
	                    computeItemKey={(_index, item) => (item as ChatMessage).id}
                    scrollerRef={(node) => {
                      messagesContainerRef.current = node instanceof HTMLElement ? node : null;
	                    }}
	                    rangeChanged={(range: ListRange) => {
	                      rangeStartIndexRef.current = range.startIndex;
	                    }}
	                    atBottomStateChange={(atBottom) => {
	                      isAtBottomRef.current = atBottom;
	                      if (atBottom) setHasUnread(false);
	                    }}
	                    startReached={() => {
	                      if (pendingAnchorMessageId) return;
	                      if (!canLoadMoreHistory) return;
	                      if (loadingMoreHistory) return;
	                      void loadMoreHistory();
	                    }}
	                    followOutput={(isAtBottom) => (isAtBottom ? 'auto' : false)}
	                    components={{
	                      Header: () => (
	                        canRequestMoreHistory ? (
	                          <div className="chat-room-page__history-bar">
	                            <Space size={8} wrap>
	                              <Button
	                                size="small"
	                                loading={loadingMoreHistory}
	                                disabled={!canLoadMoreHistory}
	                                onClick={loadMoreHistory}
	                              >
	                                {t('chat.loadMore')}
	                              </Button>
	                              {historyBlockedByCache ? (
	                                <Text type="secondary">{t('chat.historyCacheFullHint')}</Text>
	                              ) : null}
	                            </Space>
	                          </div>
	                        ) : null
	                      ),
	                      Footer: () => <div style={{ height: 80 }} />,
	                    }}
	                    itemContent={(index, item) => {
	                      const list = messages;
	                      const msg = item as ChatMessage;
	                      const localIndex = index - firstItemIndex;

	                      const role = msg.sender_participant?.role_in_room ?? 'unknown';
	                      const roleLabel = getRoleLabel(role);
	                      const side = (() => {
	                        if (msg.message_type === 'safety_notice') return 'center';
	                        if (role === 'roleA') return 'right';
	                        if (role === 'roleB') return 'left';
	                        return 'center';
	                      })();

	                      const prev = localIndex > 0 ? list[localIndex - 1] : null;
	                      const next = localIndex < list.length - 1 ? list[localIndex + 1] : null;
	                      const groupKey = `${role}:${msg.message_type}`;
	                      const prevKey = prev ? `${prev.sender_participant?.role_in_room ?? 'unknown'}:${prev.message_type}` : null;
	                      const nextKey = next ? `${next.sender_participant?.role_in_room ?? 'unknown'}:${next.message_type}` : null;
	                      const withinGroupGap = (a: ChatMessage | null, b: ChatMessage | null) => {
	                        if (!a || !b) return false;
	                        const aAt = new Date(a.created_at).getTime();
	                        const bAt = new Date(b.created_at).getTime();
	                        return Math.abs(bAt - aAt) <= 3 * 60 * 1000;
	                      };
	                      const isGroupStart = !prev || prevKey !== groupKey || !withinGroupGap(prev, msg) || msg.message_type === 'safety_notice';
	                      const isGroupEnd = !next || nextKey !== groupKey || !withinGroupGap(msg, next) || msg.message_type === 'safety_notice';

	                      const prevDay = prev ? new Date(prev.created_at).toLocaleDateString() : null;
	                      const currentDay = new Date(msg.created_at).toLocaleDateString();
	                      const showDayDivider = !prev || prevDay !== currentDay;

	                      const anchorId = `msg-${msg.id}`;
	                      const linkUrl = currentHrefWithoutHash ? `${currentHrefWithoutHash}#${anchorId}` : '';

	                      return (
	                        <div>
	                          {showDayDivider ? (
	                            <div className="chat-room-page__date-divider">
	                              <Text type="secondary">{currentDay}</Text>
	                            </div>
	                          ) : null}

	                          <div className={`chat-room-page__message-row chat-room-page__message-row--${side}`}>
	                            <div
	                              id={anchorId}
	                              className={[
	                                'chat-room-page__message-item',
	                                `chat-room-page__message-item--${side}`,
	                                msg.message_type === 'safety_notice' ? 'chat-room-page__message-item--safety' : null,
	                                replyTo?.id === msg.id ? 'chat-room-page__message-item--reply-target' : null,
	                                highlightMessageId === msg.id ? 'chat-room-page__message-item--reply-target' : null,
	                                !isGroupStart ? 'chat-room-page__message-item--grouped' : null,
	                              ].filter(Boolean).join(' ')}
	                            >
	                              {isGroupStart ? (
	                                <div className="chat-room-page__message-head">
	                                  <Space size={6} wrap>
	                                    <Tag color="default">{roleLabel}</Tag>
	                                    {msg.message_type !== 'user_text' ? <Tag color="processing">{msg.message_type}</Tag> : null}
	                                    <Tag color="purple">{msg.visibility_scope}</Tag>
	                                    {msg.ai_strategy ? <Tag color="blue">{msg.ai_strategy}</Tag> : null}
	                                  </Space>
	                                  <div className="chat-room-page__message-actions">
	                                    {msg.message_type !== 'safety_notice' ? (
	                                      <>
	                                        <Button
	                                          size="small"
	                                          type="text"
	                                          icon={<RollbackOutlined />}
	                                          disabled={disableSendMessage}
	                                          aria-label={t('chat.reply')}
	                                          onClick={(e) => {
	                                            e.stopPropagation();
	                                            setReplyTo(msg);
	                                          }}
	                                        >
	                                          {t('chat.reply')}
	                                        </Button>
	                                        <Button
	                                          size="small"
	                                          type="text"
	                                          icon={<LinkOutlined />}
	                                          aria-label={t('chat.copyLink')}
	                                          onClick={async (e) => {
	                                            e.stopPropagation();
	                                            setMessageAnchor(msg.id, { replace: true });
	                                            if (linkUrl) {
	                                              await copyToClipboard(linkUrl);
	                                            }
	                                          }}
	                                        >
	                                          {t('chat.copyLink')}
	                                        </Button>
	                                      </>
	                                    ) : null}
	                                  </div>
	                                </div>
	                              ) : (
	                                <div className="chat-room-page__message-actions chat-room-page__message-actions--floating">
	                                  {msg.message_type !== 'safety_notice' ? (
	                                    <>
	                                      <Button
	                                        size="small"
	                                        type="text"
	                                        icon={<RollbackOutlined />}
	                                        disabled={disableSendMessage}
	                                        aria-label={t('chat.reply')}
	                                        onClick={(e) => {
	                                          e.stopPropagation();
	                                          setReplyTo(msg);
	                                        }}
	                                      />
	                                      <Button
	                                        size="small"
	                                        type="text"
	                                        icon={<LinkOutlined />}
	                                        aria-label={t('chat.copyLink')}
	                                        onClick={async (e) => {
	                                          e.stopPropagation();
	                                          setMessageAnchor(msg.id, { replace: true });
	                                          if (linkUrl) {
	                                            await copyToClipboard(linkUrl);
	                                          }
	                                        }}
	                                      />
	                                    </>
	                                  ) : null}
	                                </div>
	                              )}

	                              {msg.reply_to_message_id ? (
	                                <div
	                                  className="chat-room-page__reply-preview"
	                                  role="button"
	                                  tabIndex={0}
	                                  onClick={() => {
	                                    const targetId = msg.reply_to_message_id!;
	                                    setMessageAnchor(targetId, { replace: true });
	                                    handleAnchorTarget(targetId);
	                                  }}
	                                  onKeyDown={(e) => {
	                                    if (e.key === 'Enter' || e.key === ' ') {
	                                      e.preventDefault();
	                                      const targetId = msg.reply_to_message_id!;
	                                      setMessageAnchor(targetId, { replace: true });
	                                      handleAnchorTarget(targetId);
	                                    }
	                                  }}
	                                >
	                                  <Text type="secondary">{t('chat.replyReference')}</Text>
	                                  <Paragraph className="chat-room-page__reply-preview-content">
	                                    {messageById.get(msg.reply_to_message_id)?.content ?? t('chat.replyReferenceMissing')}
	                                  </Paragraph>
	                                </div>
	                              ) : null}

	                              {msg.message_type === 'safety_notice' ? (
	                                <Alert
	                                  type="warning"
	                                  showIcon
	                                  title={t('chat.safetyMessageTitle')}
	                                  description={msg.content}
	                                />
	                              ) : (
	                                <Paragraph className="chat-room-page__message-content">{msg.content}</Paragraph>
	                              )}

	                              {isGroupEnd ? (
	                                <div className="chat-room-page__message-foot">
	                                  <Text type="secondary">{new Date(msg.created_at).toLocaleString()}</Text>
	                                </div>
	                              ) : null}
	                            </div>
	                          </div>
	                        </div>
	                      );
	                    }}
	                  />

	                  {hasUnread || jumpBackState ? (
	                    <div className="chat-room-page__bottom-bar">
	                      <div className="chat-room-page__bottom-bar-left">
	                        {jumpBackState ? (
	                          <Space size={8}>
	                            <Button
	                              size="small"
	                              onClick={() => {
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
	                              }}
	                            >
	                              {t('chat.jumpBack')}
	                            </Button>
	                            <Button
	                              size="small"
	                              type="text"
	                              aria-label={t('chat.dismiss')}
	                              onClick={() => setJumpBackState(null)}
	                            >
	                              ×
	                            </Button>
	                          </Space>
	                        ) : null}
	                      </div>
	                      <div className="chat-room-page__bottom-bar-right">
	                        {hasUnread ? (
	                          <Button
	                            size="small"
	                            type="primary"
	                            onClick={() => scrollToBottom('smooth')}
	                          >
	                            {t('chat.jumpToLatest')}
	                          </Button>
	                        ) : null}
	                      </div>
	                    </div>
	                  ) : null}
	                </>
	              )}
	            </div>

            {replyTo ? (
              <Alert
                type="info"
                showIcon
                title={t('chat.replyingTo')}
                description={replyTo.content}
                closable
                onClose={() => setReplyTo(null)}
              />
            ) : null}

            <Space style={{ width: '100%', marginBottom: 8 }}>
              <Select
                value={visibilityScope}
                onChange={setVisibilityScope}
                options={[
                  { value: 'all', label: t('chat.visibility.all') },
                  { value: 'summary_only', label: t('chat.visibility.summary_only') },
                  { value: 'owner_only', label: t('chat.visibility.owner_only') },
                ]}
                style={{ width: 180 }}
              />
            </Space>

            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={messageInput}
                maxLength={2000}
                onChange={(e) => setMessageInput(e.target.value)}
                onPressEnter={handleSendMessage}
                placeholder={t('chat.messagePlaceholder')}
              />
              <Button type="primary" disabled={disableSendMessage} loading={sending} onClick={handleSendMessage}>
                {t('chat.send')}
              </Button>
            </Space.Compact>
          </>
        )}
      </Card>

      <Modal
        open={previewVisible}
        title={t('chat.preview.title')}
        onCancel={() => {
          setPreviewVisible(false);
          setJudging(false);
          requestJudgmentLockRef.current = false;
        }}
        footer={[
          <Space key="footer" wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button
              key="selectAll"
              size="small"
              onClick={() => setSelectedForJudgment(previewList.map((m) => m.id))}
              disabled={previewList.length === 0}
            >
              {t('chat.preview.selectAll')}
            </Button>
            <Button
              key="clearAll"
              size="small"
              onClick={() => setSelectedForJudgment([])}
              disabled={previewList.length === 0}
            >
              {t('chat.preview.clearAll')}
            </Button>
            <Text key="count" type="secondary">
              {t('chat.preview.selectedCount')} {selectedForJudgment.length}/{previewList.length}
            </Text>
            <Button
              key="cancel"
              onClick={() => {
                setPreviewVisible(false);
                setJudging(false);
                requestJudgmentLockRef.current = false;
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              key="ok"
              type="primary"
              loading={judging}
              onClick={() => {
                const allowedIds = new Set(previewList.map((m) => m.id));
                const finalSelected = selectedForJudgment.filter((id) => allowedIds.has(id));
                if (finalSelected.length === 0) {
                  message.warning(t('chat.preview.mustSelectOne'));
                  if (previewList.length > 0) {
                    setSelectedForJudgment(previewList.map((m) => m.id));
                  }
                  return;
                }
                setPreviewVisible(false);
                void handleRequestJudgment(finalSelected);
              }}
            >
              {t('common.confirm')}
            </Button>
          </Space>,
        ]}
      >
        <Alert
          type="info"
          showIcon
          title={t('chat.preview.ruleTitle')}
          description={
            <>
              <div>
                {t('chat.preview.ruleVisibility')}
                {previewInfo.excludedByVisibility > 0 ? `（已排除 ${previewInfo.excludedByVisibility} 則）` : ''}
              </div>
              {previewInfo.joinAt && previewInfo.applyJoinTimeFilter ? (
                <div>
                  {t('chat.preview.ruleJoinTime')}
                  {`（B 加入：${new Date(previewInfo.joinAt).toLocaleString()}，已排除 ${previewInfo.excludedByJoinTime} 則）`}
                </div>
              ) : null}
            </>
          }
        />
        <div style={{ maxHeight: 240, overflowY: 'auto', padding: '8px 0' }}>
          {previewList.map((m) => (
            <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0' }}>
              <input
                type="checkbox"
                checked={selectedForJudgment.includes(m.id)}
                onChange={(e) => {
                  setSelectedForJudgment((prev) =>
                    e.target.checked ? (prev.includes(m.id) ? prev : [...prev, m.id]) : prev.filter((id) => id !== m.id)
                  );
                }}
              />
              <div>
                <Text strong>{new Date(m.created_at).toLocaleString()}</Text>
                <Paragraph style={{ margin: 0 }}>
                  {m.sender_participant?.role_in_room ?? ''}: {m.content}
                </Paragraph>
              </div>
            </div>
          ))}
          {previewList.length === 0 ? <Paragraph>{previewMessage}</Paragraph> : null}
        </div>
      </Modal>
    </div>
  );
};

export default ChatRoomPage;

function getJudgmentPreviewInfo(room: ChatRoom | null, messages: ChatMessage[]): {
  includedMessages: ChatMessage[];
  excludedByVisibility: number;
  excludedByJoinTime: number;
  joinAt: Date | null;
  applyJoinTimeFilter: boolean;
} {
  if (!room) {
    return {
      includedMessages: [],
      excludedByVisibility: 0,
      excludedByJoinTime: 0,
      joinAt: null,
      applyJoinTimeFilter: false,
    };
  }

  const participants = Array.isArray((room as unknown as { participants?: unknown }).participants) ? room.participants : [];
  const roleB = participants.find((p) => p.role_in_room === 'roleB' && p.is_active);
  const joinAt = roleB?.joined_at ? new Date(roleB.joined_at) : null;
  const applyJoinTimeFilter =
    !!joinAt &&
    (room.history_visibility_mode === 'share_from_join_time' || room.history_visibility_mode === 'share_summary_only');

  let excludedByVisibility = 0;
  let excludedByJoinTime = 0;
  const includedMessages: ChatMessage[] = [];

  messages.forEach((m) => {
    if (m.visibility_scope !== 'all') {
      excludedByVisibility += 1;
      return;
    }
    if (applyJoinTimeFilter && joinAt && new Date(m.created_at) < joinAt) {
      excludedByJoinTime += 1;
      return;
    }
    includedMessages.push(m);
  });

  return { includedMessages, excludedByVisibility, excludedByJoinTime, joinAt, applyJoinTimeFilter };
}
