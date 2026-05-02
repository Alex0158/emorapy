import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Spin, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import ChatBubble from '@/components/business/Interview/ChatBubble';
import InterviewInput from '@/components/business/Interview/InterviewInput';
import SafetyAlert from '@/components/business/Interview/SafetyAlert';
import MediatorAvatar from '@/components/business/MediatorAvatar';
import AIStreamingBubble from '@/components/common/AIStreamingBubble';
import AIRecoveryBadge from '@/components/common/AIRecoveryBadge';
import AIErrorState from '@/components/common/AIErrorState';
import { useInterviewStore } from '@/store/interviewStore';
import { getErrorMessage as getApiErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import { useAIStreamSubscription } from '@/hooks/useAIStreamSubscription';
import { buildLocalDraft, draftFromSnapshot, reduceDraftWithEvent, type AIStreamDraft } from '@/utils/aiStreamState';
import {
  CANONICAL_SYNC_INTERVAL_MS,
  CANONICAL_SYNC_MAX_ATTEMPTS,
  getVisibleInterviewDraft,
  isTerminalInterviewErrorCode,
  isTerminalInterviewStreamError,
  resolveInterviewErrorMessage,
  shouldShowFallbackReloadButton,
  shouldShowRateLimitHint,
} from './interviewChatUtils';
import './index.less';

const { Title, Text } = Typography;

const InterviewChat: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mountedRef = useMountedRef();
  const reloadLockRef = useRef(false);
  const canonicalSyncLockRef = useRef(false);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

  const {
    currentSession,
    turns,
    streamingText,
    isStreaming,
    streamingStatus,
    loading,
    error,
    errorCode,
    shouldEnd,
    safetyAlert,
    beginStreaming,
    finishStreaming,
    applyStreamFailure,
    applyStreamSafetyAlert,
    applyShouldEnd,
    respond,
    skipTurn,
    getSession,
    syncSessionSilently,
    endSession,
    cancelStream,
    dismissSafetyAlert,
  } = useInterviewStore();

  const {
    state: mirroredDraft,
    isRecovering: isRecoveringDraft,
    resetState: resetMirroredDraft,
  } = useAIStreamSubscription<AIStreamDraft | null>({
    scopeType: 'interview_session',
    scopeId: sessionId,
    enabled: !!sessionId && !!currentSession,
    initialState: null,
    reduceReady: (_prev, ready) => {
      const snapshots = Array.isArray(ready.snapshots) ? ready.snapshots : [];
      const latestActive = [...snapshots]
        .sort((a, b) => b.lastSeq - a.lastSeq)
        .find((snapshot) => !['persisted', 'failed'].includes(snapshot.status));
      return draftFromSnapshot(latestActive, { keepCancelled: true });
    },
    reduceEvent: (prev, event) => reduceDraftWithEvent(prev, event, { keepCancelled: true }),
    hasRecoverableState: (draft) => Boolean(draft),
    shouldClearRecoveringOnEvent: (event) => (
      event.eventType === 'stream.delta'
      || event.eventType === 'stream.completed'
      || event.eventType === 'stream.cancelled'
    ),
    onReady: (ready) => {
      if (!isStreaming) return;
      const snapshots = Array.isArray(ready.snapshots) ? ready.snapshots : [];
      const latest = [...snapshots].sort((a, b) => a.lastSeq - b.lastSeq).at(-1);
      if (!latest) return;

      // Reconnect can miss the terminal live event and only replay the latest
      // persisted snapshot. Recover the canonical session so the page does not
      // stay stuck in the optimistic streaming state forever.
      if (latest.status === 'persisted') {
        applyShouldEnd(latest.metadata?.shouldEnd === true);
        finishStreaming();
        if (sessionId) {
          void syncSessionSilently(sessionId);
        }
        return;
      }

      if (latest.status === 'failed') {
        applyStreamFailure(latest.error ?? {});
        return;
      }

      if (latest.status === 'cancelled') {
        finishStreaming();
      }
    },
    onTerminalError: (streamError) => {
      finishStreaming();
      if (streamError.status && streamError.status >= 500) {
        applyStreamFailure({
          code: 'CONNECTION_LOST',
          message: t('interview.error.connectionLost'),
        });
        return;
      }
      applyStreamFailure(streamError);
    },
    isTerminalError: isTerminalInterviewStreamError,
    onEvent: (event) => {
      if (event.eventType === 'stream.started') {
        beginStreaming();
      }
      if (event.eventType === 'stream.phase' && event.phase === 'safety_alert') {
        applyStreamSafetyAlert({
          message: typeof event.metadata?.message === 'string' ? event.metadata.message : undefined,
          severity: typeof event.metadata?.severity === 'string' ? event.metadata.severity : undefined,
        });
      }
      if (event.eventType === 'stream.persisted') {
        applyShouldEnd(event.metadata?.shouldEnd === true);
        finishStreaming();
        if (sessionId) {
          void syncSessionSilently(sessionId);
        }
      }
      if (event.eventType === 'stream.failed') {
        applyStreamFailure(event.error ?? {});
      }
      if (event.eventType === 'stream.cancelled') {
        finishStreaming();
      }
    },
  });

  // Session bootstrapping: load session on mount, cancel stream on unmount
  useEffect(() => {
    let stale = false;
    if (sessionId) {
      getSession(sessionId)
        .then(() => {
          if (stale || !mountedRef.current) return;
          setInitialLoadError(null);
        })
        .catch((err: unknown) => {
          if (stale || !mountedRef.current) return;
          setInitialLoadError(getApiErrorMessage(err, 'interview.loadFail'));
        });
    }
    return () => {
      stale = true;
      void cancelStream(sessionId);
    };
  }, [sessionId, getSession, cancelStream, mountedRef]);

  // Chat scroll behavior: scroll to bottom when turns or streaming text change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, streamingText, mirroredDraft]);

  const endingRef = useRef(false);
  const handleEnd = useCallback(async () => {
    if (!sessionId || endingRef.current) return;
    endingRef.current = true;
    try {
      if (isStreaming) {
        await cancelStream(sessionId);
      }
      await endSession(sessionId);
      if (!mountedRef.current) return;
      message.success(t('interview.endSuccess'));
      navigate(`/interview/${sessionId}/result`, { replace: true });
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      message.error(getApiErrorMessage(error, 'interview.endFail'));
    } finally {
      endingRef.current = false;
    }
  }, [sessionId, endSession, navigate, isStreaming, cancelStream, mountedRef]);

  // Session termination behavior: auto-end when shouldEnd is true and not streaming
  useEffect(() => {
    if (shouldEnd && sessionId && currentSession?.status === 'in_progress' && !isStreaming) {
      handleEnd();
    }
  }, [shouldEnd, isStreaming, sessionId, currentSession?.status, handleEnd]);

  const handleSend = useCallback(async (msg: string) => {
    if (!sessionId) return;
    try {
      resetMirroredDraft();
      await respond(sessionId, msg);
    } catch {
      // Error handled in store
    }
  }, [resetMirroredDraft, sessionId, respond]);

  const handleSkip = useCallback(async () => {
    if (!sessionId) return;
    try {
      resetMirroredDraft();
      await skipTurn(sessionId);
    } catch {
      // Error handled in store
    }
  }, [resetMirroredDraft, sessionId, skipTurn]);

  const getErrorMessage = (errMsg: string, code: string | null): string =>
    resolveInterviewErrorMessage(errMsg, code, t);

  const handleReload = useCallback(() => {
    if (!sessionId || reloadLockRef.current) return;
    reloadLockRef.current = true;
    getSession(sessionId).finally(() => { reloadLockRef.current = false; });
  }, [sessionId, getSession]);

  const handleInitialLoadRetry = useCallback(() => {
    if (!sessionId || reloadLockRef.current) return;
    reloadLockRef.current = true;
    getSession(sessionId)
      .then(() => {
        if (!mountedRef.current) return;
        setInitialLoadError(null);
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        setInitialLoadError(getApiErrorMessage(err, 'interview.loadFail'));
      })
      .finally(() => {
        reloadLockRef.current = false;
      });
  }, [sessionId, getSession, mountedRef]);

  // P03 regression guard: if SSE misses the terminal event, keep reconciling
  // the canonical session for a bounded window so the optimistic streaming
  // shell can self-heal without a manual reload.
  useEffect(() => {
    if (!sessionId || !currentSession?.id || !isStreaming) {
      canonicalSyncLockRef.current = false;
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const intervalId = window.setInterval(() => {
      if (cancelled || canonicalSyncLockRef.current || attempts >= CANONICAL_SYNC_MAX_ATTEMPTS) {
        return;
      }
      attempts += 1;
      canonicalSyncLockRef.current = true;
      void Promise.resolve(syncSessionSilently(sessionId)).finally(() => {
        canonicalSyncLockRef.current = false;
      });
    }, CANONICAL_SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      canonicalSyncLockRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [sessionId, currentSession?.id, isStreaming, syncSessionSilently]);

  const isSessionActive = currentSession?.status === 'in_progress';
  const isTerminalError = isTerminalInterviewErrorCode(errorCode);
  const streamingDraft = isStreaming
    ? buildLocalDraft({
        text: streamingText,
        status: streamingStatus ?? 'thinking',
      })
    : null;
  const bubbleDraft = getVisibleInterviewDraft(mirroredDraft, streamingDraft);
  const recoveryBadgeText = t('interview.recoveringBadge');
  const draftFallbackText = t('interview.thinking');

  if (loading && !currentSession) {
    return (
      <div className="interview-chat__loading">
        <Spin size="large" />
        <Text type="secondary">{t('interview.loadingChat')}</Text>
      </div>
    );
  }

  if (initialLoadError && !currentSession) {
    return (
      <div className="interview-chat__loading">
        <AIErrorState
          className="interview-chat__load-error"
          title={t('interview.loadFail')}
          description={initialLoadError}
          actions={(
            <Button type="primary" onClick={handleInitialLoadRetry} data-testid="interview-chat-load-retry">
              {t('common.retry')}
            </Button>
          )}
          footer={(
            <Button onClick={() => navigate('/profile/index')}>
              {t('interview.backToProfile')}
            </Button>
          )}
        />
      </div>
    );
  }

  return (
    <div className="interview-chat">
      <div className="interview-chat__header">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/profile/index')}
        />
        <div className="interview-chat__header-info">
          <Title level={5} style={{ margin: 0 }}>{t('interview.title')}</Title>
          <Text type="secondary">
            {t('interview.domainsExplored').replace('{count}', String(currentSession?.domains_touched?.length || 0))}
            {turns.length > 1 && ` · ${t('interview.turnsProgress').replace('{count}', String(turns.length - 1))}`}
          </Text>
        </div>
        {isSessionActive && turns.length >= 3 && (
          <Button size="small" onClick={handleEnd}>
            {t('interview.pauseChat')}
          </Button>
        )}
      </div>

      <div className="interview-chat__messages">
        {turns.map((turn) => (
          <React.Fragment key={turn.id}>
            {turn.ai_message && (
              <ChatBubble
                content={turn.ai_message}
                isUser={false}
                timestamp={turn.created_at}
                safetyFlag={turn.safety_flag}
              />
            )}
            {turn.user_response && (
              <ChatBubble
                content={turn.user_response}
                isUser={true}
                timestamp={turn.created_at}
              />
            )}
          </React.Fragment>
        ))}
        {bubbleDraft && (
          <AIStreamingBubble
            text={bubbleDraft.text}
            fallbackText={draftFallbackText}
            status={bubbleDraft.status}
            wrapperClassName="chat-bubble chat-bubble--ai"
            itemClassName="chat-bubble__streaming-shell"
            bodyClassName="chat-bubble__content"
            contentClassName="chat-bubble__text"
            cursorClassName="chat-bubble__cursor"
            thinkingClassName="chat-bubble__thinking"
            thinkingDotsClassName="chat-bubble__thinking-dots"
            head={isRecoveringDraft ? (
              <AIRecoveryBadge
                text={recoveryBadgeText}
                className="chat-bubble__recovery-badge"
              />
            ) : undefined}
            avatar={(
              <div className="chat-bubble__avatar">
                <MediatorAvatar size="small" />
              </div>
            )}
          />
        )}
        <div ref={chatEndRef} />
      </div>

      {safetyAlert && (
        <SafetyAlert
          message={safetyAlert.message}
          severity={safetyAlert.severity}
          onDismiss={dismissSafetyAlert}
        />
      )}

      {error && !safetyAlert && (
        <AIErrorState
          className="interview-chat__error"
          title={getErrorMessage(error, errorCode)}
          description={shouldShowRateLimitHint(errorCode)
            ? t('interview.error.rateLimitHint')
            : undefined}
          actions={(
            <>
              {errorCode === 'MAX_TURNS_REACHED' && sessionId && (
                <Button size="small" type="primary" onClick={handleEnd}>
                  {t('interview.viewResult')}
                </Button>
              )}
              {errorCode === 'SESSION_COMPLETED' && sessionId && (
                <Button size="small" type="primary" onClick={() => navigate(`/interview/${sessionId}/result`, { replace: true })}>
                  {t('interview.viewResult')}
                </Button>
              )}
              {errorCode === 'NOT_FOUND' && (
                <Button size="small" onClick={() => navigate('/profile/index')}>
                  {t('interview.backToProfile')}
                </Button>
              )}
              {errorCode === 'CONSENT_REQUIRED' && (
                <Button size="small" onClick={() => navigate('/profile/index')}>
                  {t('interview.backToProfile')}
                </Button>
              )}
              {errorCode === 'AI_CALL_FAILED' && sessionId && (
                <Button size="small" onClick={handleReload}>
                  {t('interview.reloadConversation')}
                </Button>
              )}
              {errorCode === 'CONCURRENT_REQUEST' && sessionId && (
                <Button size="small" onClick={handleReload}>
                  {t('interview.reloadConversation')}
                </Button>
              )}
              {errorCode === 'CONNECTION_LOST' && sessionId && (
                <Button size="small" onClick={handleReload}>
                  {t('interview.reloadConversation')}
                </Button>
              )}
              {sessionId &&
                shouldShowFallbackReloadButton(errorCode) && (
                  <Button size="small" onClick={handleReload} data-testid="interview-chat-reload-fallback">
                    {t('interview.reloadConversation')}
                  </Button>
                )}
            </>
          )}
        />
      )}

      {isSessionActive && !isTerminalError && (
        <InterviewInput
          onSend={handleSend}
          onStop={() => {
            void cancelStream(sessionId).then(() => {
              message.info(t('interview.cancelled'));
            });
          }}
          onSkip={handleSkip}
          disabled={loading}
          isStreaming={isStreaming}
          placeholder={t('interview.sendPlaceholder')}
        />
      )}

      {!isSessionActive && currentSession?.status === 'processing' && (
        <div className="interview-chat__processing">
          <Spin />
          <Text type="secondary">{t('interview.processing')}</Text>
          <Button
            type="link"
            onClick={() => navigate(`/interview/${sessionId}/result`, { replace: true })}
          >
            {t('interview.viewResult')}
          </Button>
        </div>
      )}

      {currentSession?.status === 'completed' && (
        <div className="interview-chat__completed">
          <Button type="primary" onClick={() => navigate(`/interview/${sessionId}/result`, { replace: true })}>
            {t('interview.viewResult')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default InterviewChat;
