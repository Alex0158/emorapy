import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { ChatChannel, ChatMessage, ChatRoom } from '@/types/chat';
import { useAuthStore } from '@/store/authStore';
import { sessionStorage } from '@/utils/storage';
import ChatRoomEntrySection from './components/ChatRoomEntrySection';
import ChatRoomHeader from './components/ChatRoomHeader';
import ChatRoomAlerts from './components/ChatRoomAlerts';
import ChatConversationLaneTabs from './components/ChatConversationLaneTabs';
import ChatContextBoundaryPanel from './components/ChatContextBoundaryPanel';
import ChatTrustCheckpoint from './components/ChatTrustCheckpoint';
import ChatCapsuleComposer from './components/ChatCapsuleComposer';
import ChatSharedContextManager from './components/ChatSharedContextManager';
import ChatContextUsageReceipts from './components/ChatContextUsageReceipts';
import ChatAnalysisConsentPanel from './components/ChatAnalysisConsentPanel';
import ChatAnalysisRequestDialog from './components/ChatAnalysisRequestDialog';
import ChatMessageList from './components/ChatMessageList';
import ChatMessageComposer from './components/ChatMessageComposer';
import ChatSharedSafetyPauseNotice from './components/ChatSharedSafetyPauseNotice';
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
import { useChatLaneHistoryView } from './hooks/useChatLaneHistoryView';
import { useChatRoomMessageController } from './hooks/useChatRoomMessageController';
import { useChatRoomParticipantActions } from './hooks/useChatRoomParticipantActions';
import { useChatPrivateChannelUpdates } from './hooks/useChatPrivateChannelUpdates';
import { usePrivateContextPreference } from './hooks/usePrivateContextPreference';
import { useChatAnalysisConsent } from './hooks/useChatAnalysisConsent';
import { useChatCapsuleLifecycle } from './hooks/useChatCapsuleLifecycle';
import { useChatContextUsageReceipts } from './hooks/useChatContextUsageReceipts';
import { useChatRoomRouteLoader } from './hooks/useChatRoomRouteLoader';
import { useChatRoomUiState } from './hooks/useChatRoomUiState';
import { useChatRoomSafetyStatus } from './hooks/useChatRoomSafetyStatus';
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
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [lastInviteCode, setLastInviteCode] = useState('');
  const [errorText, setErrorText] = useState('');
  const mountedRef = useMountedRef();
  const lastRoomStatusNoticeAtRef = useRef<string | null>(null);
  const initializedLaneRoomIdRef = useRef<string | null>(null);
  const contextPreferenceMembershipRef = useRef<string | null>(null);

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
    activeLane,
    messageInput,
    replyTo,
    setMessageInput,
    setActiveLane,
    setReplyTo,
    visibilityScope,
  } = useChatRoomUiState({ activeRoomId });
  const privateChannel = useMemo(
    () => channels.find((channel) => channel.kind === 'private') ?? null,
    [channels],
  );
  const sharedChannel = useMemo(
    () => channels.find((channel) => channel.kind === 'shared') ?? null,
    [channels],
  );
  const activeChannelId = activeLane === 'private'
    ? privateChannel?.id ?? null
    : sharedChannel?.id ?? null;
  const contextPreference = usePrivateContextPreference(activeRoomId);
  const safetyStatus = useChatRoomSafetyStatus(activeRoomId);
  const refreshSafetyStatus = useCallback(() => {
    void safetyStatus.refresh(false);
  }, [safetyStatus.refresh]);
  const activeHumanMembershipKey = useMemo(() => (
    room?.participants
      ?.filter((participant) => (
        participant.is_active
        && (participant.role_in_room === 'roleA' || participant.role_in_room === 'roleB')
      ))
      .map((participant) => `${participant.id}:${participant.joined_at}`)
      .sort()
      .join('|') ?? ''
  ), [room?.participants]);
  const activeHumanParticipantCount = useMemo(() => (
    room?.participants?.filter((participant) => (
      participant.is_active
      && (participant.role_in_room === 'roleA' || participant.role_in_room === 'roleB')
    )).length ?? 0
  ), [room?.participants]);
  const requiresSharedGovernance = activeHumanParticipantCount >= 2;
  const sharedGovernanceBlocked = requiresSharedGovernance && (
    !contextPreference.ready
    || contextPreference.adaptationDecision === 'not_set'
  );
  useEffect(() => {
    if (!activeRoomId) {
      contextPreferenceMembershipRef.current = null;
      return;
    }
    const signature = `${activeRoomId}::${activeHumanMembershipKey}`;
    const previous = contextPreferenceMembershipRef.current;
    contextPreferenceMembershipRef.current = signature;
    if (previous?.startsWith(`${activeRoomId}::`) && previous !== signature) {
      void contextPreference.refresh(false);
    }
  }, [activeHumanMembershipKey, activeRoomId, contextPreference.refresh]);
  const laneHistory = useChatLaneHistoryView({
    roomId: activeRoomId,
    activeLane,
    messages,
    privateChannelId: privateChannel?.id ?? null,
    sharedChannelId: sharedChannel?.id ?? null,
  });
  const laneMessages = laneHistory.activeMessages;
  const hasSharedMessages = useMemo(
    () => laneHistory.messagesByLane.shared.some((message) => (
      message.message_type !== 'safety_notice'
      && message.message_type !== 'system_event'
    )),
    [laneHistory.messagesByLane.shared],
  );

  const history = useChatRoomHistoryController({
    room,
    messages,
    activeLane,
    activeMessages: laneMessages,
    activeFirstItemIndex: laneHistory.activeFirstItemIndex,
    activeMessageIndexById: laneHistory.activeMessageIndexById,
    activeIsAtBottomRef: laneHistory.activeIsAtBottomRef,
    activeRangeStartIndexRef: laneHistory.activeRangeStartIndexRef,
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
    isAtBottomRef: laneHistory.activeIsAtBottomRef,
    pendingAnchorMessageIdRef: history.pendingAnchorMessageIdRef,
    loadingMoreHistoryRef: history.loadingMoreHistoryRef,
    historyCursorRef: history.historyCursorRef,
    hasMoreHistoryRef: history.hasMoreHistoryRef,
    showRoomStatusNotice,
    onRoomRefreshRequested: refreshSafetyStatus,
  });
  useChatPrivateChannelUpdates({
    roomId: activeRoomId,
    privateChannelId: privateChannel?.id ?? null,
    refreshRoomSafely,
  });

  const {
    creatingRoom,
    joiningInvite,
    decliningInvite,
    handleCreateRoom,
    handleAcceptInvite,
    handleDeclineInvite,
  } = useChatRoomEntryActions({
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
    clearJudgmentPolling,
    handleRequestJudgment,
    hasSafetyInterruption,
    judging,
    latestSafetyNotice,
  } = useChatRoomJudgmentController({
    room,
    messages,
    mountedRef,
    isRoomTargetActive,
    navigateToJudgment,
    refreshRoomSafely,
    setErrorText,
    showChatActionFeedback,
  });

  const {
    aiDraft,
    handleSendMessage,
    resetAIDraft,
    sending,
  } = useChatRoomMessageController({
    room,
    activeRoomId,
    activeChannelId,
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
    setChannels,
    setFirstItemIndex: history.setFirstItemIndex,
    setErrorText,
    setLastInviteCode,
    setHighlightMessageId: history.setHighlightMessageId,
    setHistoryCursor: history.setHistoryCursor,
    setHasMoreHistory: history.setHasMoreHistory,
    setLoadingMoreHistory: history.setLoadingMoreHistory,
    firstItemIndexRef: history.firstItemIndexRef,
    messagesRef: history.messagesRef,
    historyCursorRef: history.historyCursorRef,
    hasMoreHistoryRef: history.hasMoreHistoryRef,
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
  const myParticipantId = useMemo(() => {
    const participantByUser = room?.participants?.find((participant) => (
      participant.user_id === currentUserId
      && participant.participant_type === 'user'
      && participant.is_active
    ));
    if (participantByUser) return participantByUser.id;
    if (!isOwner) return null;
    return room?.participants?.find((participant) => (
      participant.role_in_room === 'roleA'
      && participant.participant_type === 'user'
      && participant.is_active
    ))?.id ?? null;
  }, [currentUserId, isOwner, room?.participants]);
  const getParticipantLabel = useCallback((participantId: string) => {
    const participant = room?.participants?.find((candidate) => candidate.id === participantId);
    return getRoleLabel(participant?.role_in_room);
  }, [room?.participants]);
  const analysisConsent = useChatAnalysisConsent({
    roomId: activeRoomId,
    messages,
    sharedChannelId: sharedChannel?.id ?? null,
    myParticipantId,
    blocked: hasSafetyInterruption || safetyStatus.blocked || sharedGovernanceBlocked,
    onStartAnalysis: handleRequestJudgment,
  });
  const usageReceipts = useChatContextUsageReceipts(activeRoomId);
  const refreshCapsuleContext = useCallback(async (showLoading = false) => {
    await Promise.all([
      analysisConsent.refresh(showLoading),
      usageReceipts.refresh(showLoading),
    ]);
  }, [analysisConsent.refresh, usageReceipts.refresh]);
  const capsuleLifecycle = useChatCapsuleLifecycle({
    roomId: activeRoomId,
    refresh: refreshCapsuleContext,
  });
  const trustCheckpointRequired = (
    requiresSharedGovernance
    && contextPreference.ready
    && contextPreference.adaptationDecision === 'not_set'
  );
  useEffect(() => {
    if (!activeRoomId || loading) return;
    if (initializedLaneRoomIdRef.current === activeRoomId) return;
    if (requiresSharedGovernance && !contextPreference.ready) return;
    initializedLaneRoomIdRef.current = activeRoomId;
    setActiveLane(hasSharedMessages && !sharedGovernanceBlocked ? 'shared' : 'private');
  }, [
    activeRoomId,
    contextPreference.ready,
    hasSharedMessages,
    loading,
    requiresSharedGovernance,
    setActiveLane,
    sharedGovernanceBlocked,
  ]);

  useEffect(() => {
    if (activeRoomId && initializedLaneRoomIdRef.current !== activeRoomId) return;
    if (
      activeLane === 'shared'
      && ((!hasActiveRoleB && !hasSharedMessages) || sharedGovernanceBlocked)
    ) {
      setActiveLane('private');
    }
  }, [
    activeLane,
    activeRoomId,
    hasActiveRoleB,
    hasSharedMessages,
    setActiveLane,
    sharedGovernanceBlocked,
  ]);

  const messageById = useMemo(() => buildMessageMap(laneMessages), [laneMessages]);

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
            <ChatTrustCheckpoint
              open={trustCheckpointRequired}
              saving={contextPreference.saving}
              onDecision={(decision) => {
                void contextPreference.updateAdaptationDecision(decision);
              }}
            />
            <div className="flex flex-col gap-3 w-full">
              <ChatRoomHeader
                roomId={routeRoomId!}
                room={room}
                myRole={myRole}
                isOwner={!!isOwner}
                hasActiveRoleB={!!hasActiveRoleB}
                getRoleLabel={getRoleLabel}
                disableCreateInvite={disableCreateInvite}
                disableRequestJudgment={
                  disableRequestJudgment
                  || hasSafetyInterruption
                  || safetyStatus.blocked
                  || sharedGovernanceBlocked
                  || analysisConsent.hasOpenRequest
                  || analysisConsent.loading
                }
                creatingInvite={creatingInvite}
                judging={judging}
                leavingRoom={leavingRoom}
                kickingB={kickingB}
                canLeaveRoom={!!canLeaveRoom}
                canKickB={!!canKickB}
                onCreateInvite={handleCreateInvite}
                onRequestJudgment={analysisConsent.openSelection}
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
              <ChatAnalysisConsentPanel
                requests={analysisConsent.requests}
                myParticipantId={myParticipantId}
                workingRequestId={analysisConsent.workingRequestId}
                loading={analysisConsent.loading}
                error={analysisConsent.loadError}
                formalActionsDisabled={
                  hasSafetyInterruption || safetyStatus.blocked || sharedGovernanceBlocked
                }
                getParticipantLabel={getParticipantLabel}
                onRefresh={() => { void analysisConsent.refresh(true); }}
                onDecision={(request, decision) => { void analysisConsent.decide(request, decision); }}
                onRevokeApproval={(request) => { void analysisConsent.revokeApproval(request); }}
                onSubmitAndStart={(request) => { void analysisConsent.submitAndStart(request); }}
              />
              <ChatConversationLaneTabs
                activeLane={activeLane}
                sharedDisabled={
                  (!hasActiveRoleB && !hasSharedMessages) || sharedGovernanceBlocked
                }
                sharedReadOnly={!hasActiveRoleB && hasSharedMessages}
                onLaneChange={setActiveLane}
              />
              <ChatContextBoundaryPanel
                activeLane={activeLane}
                adaptationDecision={contextPreference.adaptationDecision}
                mode={contextPreference.mode}
                loading={contextPreference.loading}
                roomAdaptation={contextPreference.roomAdaptation}
                saving={contextPreference.saving}
                unavailable={contextPreference.unavailable}
                onRetry={() => { void contextPreference.refresh(true); }}
                onAdaptationDecisionChange={(decision) => {
                  void contextPreference.updateAdaptationDecision(decision);
                }}
                onModeChange={(mode) => { void contextPreference.updateMode(mode); }}
              />
              <section
                id="chat-conversation-panel"
                role="tabpanel"
                aria-labelledby={`chat-lane-${activeLane}-tab`}
                tabIndex={0}
                className="rounded-2xl border border-border/70 bg-card/40 p-3 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {activeLane === 'shared' && safetyStatus.blocked && (
                  <ChatSharedSafetyPauseNotice
                    loading={safetyStatus.loading}
                    onSwitchToPrivate={() => setActiveLane('private')}
                    status={safetyStatus.status}
                    unavailable={safetyStatus.unavailable}
                  />
                )}
                <ChatMessageList
                  key={activeLane}
                  messages={laneMessages}
                  firstItemIndex={laneHistory.activeFirstItemIndex}
                  virtuosoRef={history.virtuosoRef}
                  messagesContainerRef={history.messagesContainerRef}
                  onRangeChanged={(range) => {
                    laneHistory.handleRangeStartIndexChange(range.startIndex);
                  }}
                  onAtBottomChange={laneHistory.handleAtBottomChange}
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
                  disableSendMessage={
                    disableSendMessage
                    || !activeChannelId
                    || (activeLane === 'shared' && (
                      safetyStatus.blocked || sharedGovernanceBlocked
                    ))
                  }
                  setMessageAnchor={history.setMessageAnchor}
                  handleAnchorTarget={history.handleAnchorTarget}
                  getRoleLabel={getRoleLabel}
                  getVisibilityScopeLabel={getVisibilityScopeLabel}
                  setReplyTo={setReplyTo}
                  hasUnread={laneHistory.hasUnread}
                  jumpBackState={history.jumpBackState}
                  onJumpBack={history.handleJumpBack}
                  onDismissJumpBack={() => history.setJumpBackState(null)}
                  onJumpToLatest={() => {
                    laneHistory.clearActiveUnread();
                    history.scrollToBottom('smooth');
                  }}
                  emptyMessageKey={activeLane === 'private' ? 'chat.lane.privateEmpty' : 'chat.lane.sharedEmpty'}
                />
                {activeLane === 'private' && activeRoomId && privateChannel && (
                  <ChatCapsuleComposer
                    roomId={activeRoomId}
                    privateChannelId={privateChannel.id}
                    messages={laneMessages}
                    onSaved={() => { void refreshCapsuleContext(false); }}
                  />
                )}
                {activeLane === 'private' && activeRoomId && (
                  <ChatSharedContextManager
                    capsules={analysisConsent.allCapsules}
                    formalActionsBlocked={
                      hasSafetyInterruption || safetyStatus.blocked || sharedGovernanceBlocked
                    }
                    workingActionKey={capsuleLifecycle.workingActionKey}
                    workingAuthorizationId={analysisConsent.workingAuthorizationId}
                    onDiscard={(capsule) => { void capsuleLifecycle.discard(capsule); }}
                    onGrant={(capsule, purpose) => { void capsuleLifecycle.grant(capsule, purpose); }}
                    onRevokeAuthorization={(authorizationId) => {
                      void analysisConsent.revokeAuthorization(authorizationId);
                    }}
                    onRevise={(capsule, summary) => { void capsuleLifecycle.revise(capsule, summary); }}
                  />
                )}
                {activeLane === 'private' && activeRoomId && (
                  <ChatContextUsageReceipts
                    error={usageReceipts.error}
                    loading={usageReceipts.loading}
                    receipts={usageReceipts.receipts}
                    onRefresh={() => { void usageReceipts.refresh(true); }}
                  />
                )}
                <ChatMessageComposer
                  lane={activeLane}
                  messageInput={messageInput}
                  onMessageInputChange={setMessageInput}
                  replyTo={replyTo}
                  onClearReply={() => setReplyTo(null)}
                  disableSend={
                    !activeChannelId
                    || disableSendMessage
                    || (activeLane === 'shared' && (
                      !hasActiveRoleB || safetyStatus.blocked || sharedGovernanceBlocked
                    ))
                  }
                  sending={sending}
                  onSend={handleSendMessage}
                />
              </section>
            </div>
          </>
        )}
      </div>

      <ChatAnalysisRequestDialog
        open={analysisConsent.selectionOpen}
        messages={analysisConsent.eligibleMessages}
        capsules={analysisConsent.capsules}
        selectedMessageIds={analysisConsent.selectedMessageIds}
        selectedCapsuleIds={analysisConsent.selectedCapsuleIds}
        creating={analysisConsent.creating}
        getRoleLabel={getRoleLabel}
        onSelectedMessageIdsChange={analysisConsent.setSelectedMessageIds}
        onSelectedCapsuleIdsChange={analysisConsent.setSelectedCapsuleIds}
        onClose={analysisConsent.closeSelection}
        onCreate={() => { void analysisConsent.createAndApprove(); }}
      />
    </div>
  );
};

export default ChatRoomPage;
