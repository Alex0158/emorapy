import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { t } from '@/utils/i18n';
import { useAIStreamSubscription } from '@/hooks/useAIStreamSubscription';
import { draftFromSnapshot, reduceDraftWithEvent, type AIStreamDraft } from '@/utils/aiStreamState';
import type { ChatMessage, ChatRoom } from '@/types/chat';
import { useAuthStore } from '@/store/authStore';
import { sessionStorage } from '@/utils/storage';
import type { VirtuosoHandle } from 'react-virtuoso';
import ChatRoomEntrySection from './components/ChatRoomEntrySection';
import ChatRoomHeader from './components/ChatRoomHeader';
import ChatRoomAlerts from './components/ChatRoomAlerts';
import ChatMessageList from './components/ChatMessageList';
import ChatMessageComposer from './components/ChatMessageComposer';
import ChatJudgmentPanel, { getJudgmentPreviewInfo } from './components/ChatJudgmentPanel';
import {
  AI_THINKING_TIMEOUT_MS,
  INITIAL_FIRST_ITEM_INDEX,
  buildMessageMap,
  findLatestSafetyNotice,
  getAiStrategyLabel,
  getMessageTypeLabel,
  getRoleLabel,
  getRoomStatusNoticeFeedback,
  getVisibilityScopeLabel,
  isRoomActionBlocked,
  isTerminalStreamError,
  mergeSortedMessages,
  shouldApplyRoomRefresh,
  shouldAllowMessageCacheTrim,
  trimMessagesToCacheLimit,
} from './chatRoomUtils';
import { useChatRoomDerivedState } from './hooks/useChatRoomDerivedState';
import { useChatRoomEntryActions } from './hooks/useChatRoomEntryActions';
import { useChatRoomHistoryNavigation } from './hooks/useChatRoomHistoryNavigation';
import { useChatRoomInviteActions } from './hooks/useChatRoomInviteActions';
import { useChatRoomJudgmentActions } from './hooks/useChatRoomJudgmentActions';
import { useChatRoomLiveUpdates } from './hooks/useChatRoomLiveUpdates';
import { useChatRoomMessageActions } from './hooks/useChatRoomMessageActions';
import { useChatRoomParticipantActions } from './hooks/useChatRoomParticipantActions';
import { useChatRoomRouteLoader } from './hooks/useChatRoomRouteLoader';
import { useChatRoomUiState } from './hooks/useChatRoomUiState';
import './index.css';

const ChatRoomPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomId: routeRoomId } = useParams<{ roomId: string }>();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const activeRouteRoomIdRef = useRef<string | null>(routeRoomId ?? null);
  activeRouteRoomIdRef.current = routeRoomId ?? null;

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [firstItemIndex, setFirstItemIndex] = useState(INITIAL_FIRST_ITEM_INDEX);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [lastInviteCode, setLastInviteCode] = useState('');
  const [visibilityMode, setVisibilityMode] = useState<'share_full_history' | 'share_summary_only' | 'share_from_join_time'>(
    'share_summary_only'
  );
  const [errorText, setErrorText] = useState('');
  const [hasUnread, setHasUnread] = useState(false);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [pendingAnchorMessageId, setPendingAnchorMessageId] = useState<string | null>(null);
  const [jumpBackState, setJumpBackState] = useState<{ originMessageId: string | null; wasAtBottom: boolean } | null>(null);
  const mountedRef = useMountedRef();
  const lastRoomStatusNoticeAtRef = useRef<string | null>(null);
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
  const pendingAnchorMessageIdRef = useRef<string | null>(pendingAnchorMessageId);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const rangeStartIndexRef = useRef(0);
  const thinkingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearThinkingTimeout = useCallback(() => {
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current);
      thinkingTimeoutRef.current = null;
    }
  }, []);

  const showChatActionFeedback = useCallback((feedback: { level: 'warning' | 'error'; message: string }) => {
    if (feedback.level === 'warning') {
      toast.warning(feedback.message);
    } else {
      toast.error(feedback.message);
    }
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
    firstItemIndexRef.current = firstItemIndex;
    const indexMap = new Map<string, number>();
    messages.forEach((m, idx) => indexMap.set(m.id, firstItemIndex + idx));
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
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  }, []);

  const showRoomStatusNotice = useCallback((event: { at?: string; payload?: Record<string, unknown> }) => {
    if (!mountedRef.current) return;
    const at = typeof event.at === 'string' ? event.at : null;
    if (at && lastRoomStatusNoticeAtRef.current === at) return;

    const feedback = getRoomStatusNoticeFeedback(event);
    if (feedback?.level === 'success') {
      toast.success(feedback.message);
    } else if (feedback?.level === 'info') {
      toast.info(feedback.message);
    }

    lastRoomStatusNoticeAtRef.current = at ?? String(Date.now());
  }, [mountedRef]);

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
      toast.info(t('chat.message.referenceNotLoaded'));
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

  const scrollToMessageIndex = useCallback((index: number) => {
    virtuosoRef.current?.scrollToIndex({ index, align: 'start', behavior: 'smooth' });
  }, []);

  const trimMessageCache = useCallback((list: ChatMessage[], opts?: { allowTrim?: boolean }) => {
    const result = trimMessagesToCacheLimit(list, { allowTrim: opts?.allowTrim });
    if (result.removedCount > 0) {
      setFirstItemIndex((prev) => prev + result.removedCount);
    }
    return result.messages;
  }, []);

  const isRoomTargetActive = useCallback((targetRoomId: string) => (
    shouldApplyRoomRefresh({
      targetRoomId,
      activeRouteRoomId: activeRouteRoomIdRef.current,
    })
  ), []);

  const navigateToRoomEntry = useCallback(() => {
    navigate('/chat/room');
  }, [navigate]);

  const isEntryRouteActive = useCallback(() => activeRouteRoomIdRef.current === null, []);
  const navigateToCreatedRoom = useCallback((created: ChatRoom) => {
    navigate(`/chat/room/${created.id}`, { state: { room: created } });
  }, [navigate]);
  const navigateToJoinedRoom = useCallback((targetRoomId: string) => {
    navigate(`/chat/room/${targetRoomId}`);
  }, [navigate]);
  const navigateToJudgment = useCallback((judgmentId: string) => {
    navigate(`/judgment/${judgmentId}`);
  }, [navigate]);

  const activeRoomId = room?.id ?? null;
  const {
    closeJudgmentPreview,
    messageInput,
    openJudgmentPreview: showJudgmentPreview,
    previewVisible,
    replyTo,
    selectedForJudgment,
    setMessageInput,
    setReplyTo,
    setSelectedForJudgment,
    setVisibilityScope,
    visibilityScope,
  } = useChatRoomUiState({ activeRoomId });

  const {
    clearRoomPolling,
    clearRoomStreamRetry,
    cleanupRoomStream,
    ensureRoomPolling,
    refreshRoomSafely,
  } = useChatRoomLiveUpdates({
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
  });

  const {
    creatingRoom,
    joiningInvite,
    decliningInvite,
    handleCreateRoom,
    handleAcceptInvite,
    handleDeclineInvite,
  } = useChatRoomEntryActions({
    visibilityMode,
    inviteCodeInput,
    mountedRef,
    isEntryRouteActive,
    setRoom,
    setErrorText,
    setLastInviteCode,
    navigateToCreatedRoom,
    navigateToJoinedRoom,
  });

  const {
    creatingInvite,
    handleCreateInvite,
  } = useChatRoomInviteActions({
    room,
    mountedRef,
    isRoomTargetActive,
    refreshRoomSafely,
    setErrorText,
    setLastInviteCode,
    showChatActionFeedback,
  });

  const {
    leavingRoom,
    kickingB,
    handleLeaveRoomAction,
    handleKickB,
  } = useChatRoomParticipantActions({
    room,
    mountedRef,
    isRoomTargetActive,
    navigateToRoomEntry,
    refreshRoomSafely,
  });

  const {
    cancelJudgmentRequest,
    clearJudgmentPolling,
    handleRequestJudgment,
    judging,
  } = useChatRoomJudgmentActions({
    room,
    mountedRef,
    isRoomTargetActive,
    navigateToJudgment,
    refreshRoomSafely,
    setErrorText,
    showChatActionFeedback,
  });

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

  const showAIThinkingDraft = useCallback(() => {
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
  }, [clearThinkingTimeout, mountedRef, setAIDraft]);

  const shouldTrimMessageCacheAfterSend = useCallback(() => (
    shouldAllowMessageCacheTrim({
      isAtBottom: isAtBottomRef.current,
      pendingAnchorMessageId: pendingAnchorMessageIdRef.current,
      loadingMoreHistory: loadingMoreHistoryRef.current,
    })
  ), []);

  const {
    sending,
    handleSendMessage,
  } = useChatRoomMessageActions({
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
  });

  const {
    canLoadMoreHistory,
    canRequestMoreHistory,
    handleAnchorTarget,
    handleJumpBack,
    historyBlockedByCache,
    loadMoreHistory,
    resetHistoryNavigation,
    setMessageAnchor,
  } = useChatRoomHistoryNavigation({
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

  const {
    handleRetryLoad,
    loading,
  } = useChatRoomRouteLoader({
    routeRoomId,
    locationState: location.state,
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
  });

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

  const openJudgmentPreview = useCallback(() => {
    if (!room?.id) return;
    if (isRoomActionBlocked(room.status)) return;
    const included = getJudgmentPreviewInfo(room, messages).includedMessages.map((m) => m.id);
    showJudgmentPreview(included);
  }, [messages, room, showJudgmentPreview]);

  const sessionId = sessionStorage.get();
  const {
    isOwner,
    hasActiveRoleB,
    disableSendMessage,
    disableCreateInvite,
    disableRequestJudgment,
    myRole,
    canKickB,
    canLeaveRoom,
  } = useChatRoomDerivedState({
    room,
    currentUserId,
    sessionId,
    sending,
    creatingInvite,
    judging,
  });
  const messageById = useMemo(() => buildMessageMap(messages), [messages]);

  const previewInfo = useMemo(() => getJudgmentPreviewInfo(room, messages), [messages, room]);

  const latestSafetyNotice = useMemo(() => findLatestSafetyNotice(messages), [messages]);

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
      <div className="chat-room-page__panel">
        {loading ? (
          <div className="chat-room-page__loading">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 w-full">
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
                leavingRoom={leavingRoom}
                kickingB={kickingB}
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
            </div>
          </>
        )}
      </div>

      <ChatJudgmentPanel
        open={previewVisible}
        previewInfo={previewInfo}
        selectedForJudgment={selectedForJudgment}
        onSelectedChange={setSelectedForJudgment}
        judging={judging}
        getRoleLabel={getRoleLabel}
        onCancel={() => {
          closeJudgmentPreview();
          cancelJudgmentRequest();
        }}
        onConfirm={handleRequestJudgment}
      />
    </div>
  );
};

export default ChatRoomPage;
