import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { ChatMessage, ChatRoom } from '@/types/chat';
import { useAuthStore } from '@/store/authStore';
import { sessionStorage } from '@/utils/storage';
import ChatRoomEntrySection from './components/ChatRoomEntrySection';
import ChatRoomHeader from './components/ChatRoomHeader';
import ChatRoomAlerts from './components/ChatRoomAlerts';
import ChatMessageList from './components/ChatMessageList';
import ChatMessageComposer from './components/ChatMessageComposer';
import ChatJudgmentPanel from './components/ChatJudgmentPanel';
import {
  buildMessageMap,
  getRoleLabel,
  getRoomStatusNoticeFeedback,
  getVisibilityScopeLabel,
  shouldApplyRoomRefresh,
} from './chatRoomUtils';
import { useChatRoomDerivedState } from './hooks/useChatRoomDerivedState';
import { useChatRoomEntryActions } from './hooks/useChatRoomEntryActions';
import { useChatRoomHistoryController } from './hooks/useChatRoomHistoryController';
import { useChatRoomInviteActions } from './hooks/useChatRoomInviteActions';
import { useChatRoomJudgmentController } from './hooks/useChatRoomJudgmentController';
import { useChatRoomLiveUpdates } from './hooks/useChatRoomLiveUpdates';
import { useChatRoomMessageController } from './hooks/useChatRoomMessageController';
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
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [lastInviteCode, setLastInviteCode] = useState('');
  const [visibilityMode, setVisibilityMode] = useState<'share_full_history' | 'share_summary_only' | 'share_from_join_time'>(
    'share_summary_only'
  );
  const [errorText, setErrorText] = useState('');
  const mountedRef = useMountedRef();
  const lastRoomStatusNoticeAtRef = useRef<string | null>(null);

  const showChatActionFeedback = useCallback((feedback: { level: 'warning' | 'error'; message: string }) => {
    if (feedback.level === 'warning') {
      toast.warning(feedback.message);
    } else {
      toast.error(feedback.message);
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

  const history = useChatRoomHistoryController({
    room,
    messages,
    setMessages,
    mountedRef,
    isRoomTargetActive,
  });

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
    setHistoryCursor: history.setHistoryCursor,
    setHasMoreHistory: history.setHasMoreHistory,
    setErrorText,
    trimMessageCache: history.trimMessageCache,
    isAtBottomRef: history.isAtBottomRef,
    pendingAnchorMessageIdRef: history.pendingAnchorMessageIdRef,
    loadingMoreHistoryRef: history.loadingMoreHistoryRef,
    historyCursorRef: history.historyCursorRef,
    hasMoreHistoryRef: history.hasMoreHistoryRef,
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
    hasSafetyInterruption,
    judging,
    latestSafetyNotice,
    openJudgmentPreview,
    previewInfo,
  } = useChatRoomJudgmentController({
    room,
    messages,
    mountedRef,
    isRoomTargetActive,
    navigateToJudgment,
    refreshRoomSafely,
    setErrorText,
    showChatActionFeedback,
    previewVisible,
    showJudgmentPreview,
    closeJudgmentPreview,
  });

  const {
    aiDraft,
    handleSendMessage,
    resetAIDraft,
    sending,
  } = useChatRoomMessageController({
    room,
    activeRoomId,
    messageInput,
    visibilityScope,
    replyTo,
    mountedRef,
    isRoomTargetActive,
    shouldTrimMessageCacheAfterSend: history.shouldTrimMessageCacheAfterSend,
    trimMessageCache: history.trimMessageCache,
    setMessages,
    setMessageInput,
    setReplyTo,
    setErrorText,
    showChatActionFeedback,
    refreshRoomSafely,
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
    setFirstItemIndex: history.setFirstItemIndex,
    setErrorText,
    setLastInviteCode,
    setHasUnread: history.setHasUnread,
    setHighlightMessageId: history.setHighlightMessageId,
    setHistoryCursor: history.setHistoryCursor,
    setHasMoreHistory: history.setHasMoreHistory,
    setLoadingMoreHistory: history.setLoadingMoreHistory,
    firstItemIndexRef: history.firstItemIndexRef,
    messagesRef: history.messagesRef,
    historyCursorRef: history.historyCursorRef,
    hasMoreHistoryRef: history.hasMoreHistoryRef,
    prevMessageCountRef: history.prevMessageCountRef,
    isAtBottomRef: history.isAtBottomRef,
    clearRoomPolling,
    ensureRoomPolling,
    clearJudgmentPolling,
    cleanupRoomStream,
    clearRoomStreamRetry,
    clearHighlightTimer: history.clearHighlightTimer,
    resetAIDraft,
    resetHistoryNavigation: history.resetHistoryNavigation,
    scrollToBottom: history.scrollToBottom,
  });

  useEffect(() => {
    // 新訊息進來時：
    // - 若使用者已在底部（或接近底部），自動捲到底
    // - 否則標記 unread，提供「跳到最新」操作
    if (!routeRoomId) return;
    const nextCount = messages.length;
    const prevCount = history.prevMessageCountRef.current;
    history.prevMessageCountRef.current = nextCount;
    if (nextCount === 0) return;
    if (nextCount <= prevCount) return;

    if (!history.isAtBottomRef.current) {
      history.setHasUnread(true);
    }
  }, [messages, routeRoomId]);

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
                disableRequestJudgment={disableRequestJudgment || hasSafetyInterruption}
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
                firstItemIndex={history.firstItemIndex}
                virtuosoRef={history.virtuosoRef}
                messagesContainerRef={history.messagesContainerRef}
                onRangeChanged={(range) => { history.rangeStartIndexRef.current = range.startIndex; }}
                onAtBottomChange={(atBottom) => {
                  history.isAtBottomRef.current = atBottom;
                  if (atBottom) history.setHasUnread(false);
                }}
                onStartReached={() => {
                  if (history.pendingAnchorMessageId) return;
                  if (!history.canLoadMoreHistory) return;
                  if (history.loadingMoreHistory) return;
                  void history.loadMoreHistory();
                }}
                canRequestMoreHistory={history.canRequestMoreHistory}
                canLoadMoreHistory={history.canLoadMoreHistory}
                loadingMoreHistory={history.loadingMoreHistory}
                historyBlockedByCache={history.historyBlockedByCache}
                onLoadMoreHistory={history.loadMoreHistory}
                aiDraft={aiDraft}
                currentHrefWithoutHash={currentHrefWithoutHash}
                messageById={messageById}
                replyTo={replyTo}
                highlightMessageId={history.highlightMessageId}
                disableSendMessage={disableSendMessage}
                setMessageAnchor={history.setMessageAnchor}
                handleAnchorTarget={history.handleAnchorTarget}
                getRoleLabel={getRoleLabel}
                getVisibilityScopeLabel={getVisibilityScopeLabel}
                setReplyTo={setReplyTo}
                hasUnread={history.hasUnread}
                jumpBackState={history.jumpBackState}
                onJumpBack={history.handleJumpBack}
                onDismissJumpBack={() => history.setJumpBackState(null)}
                onJumpToLatest={() => history.scrollToBottom('smooth')}
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
