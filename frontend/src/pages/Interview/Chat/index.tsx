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
import './index.less';

const { Title, Text } = Typography;

const ERROR_MESSAGES: Record<string, string> = {
  CONSENT_REQUIRED: 'interview.error.consentRequired',
  MAX_TURNS_REACHED: 'interview.error.maxTurns',
  SESSION_COMPLETED: 'interview.error.sessionCompleted',
  RATE_LIMIT_EXCEEDED: 'interview.error.rateLimit',
  NOT_FOUND: 'interview.error.notFound',
  RESPONSE_TIMEOUT: 'interview.error.timeout',
  CONNECTION_TIMEOUT: 'interview.error.connectionTimeout',
  CONNECTION_LOST: 'interview.error.connectionLost',
  TURN_TOO_FAST: 'interview.error.turnTooFast',
  AI_CALL_FAILED: 'interview.error.aiCallFailed',
  CONCURRENT_REQUEST: 'interview.error.concurrentRequest',
};

const InterviewChat: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mountedRef = useMountedRef();
  const reloadLockRef = useRef(false);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

  const {
    currentSession,
    turns,
    streamingText,
    isStreaming,
    streamingStatus,
    cancelledDraft,
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

  const isTerminalStreamError = useCallback((error: { code?: string; status?: number }) => {
    if (error.status && [400, 401, 403, 404].includes(error.status)) {
      return true;
    }
    if (error.code && ['INVALID_SESSION_ID', 'SESSION_EXPIRED', 'FORBIDDEN', 'NOT_FOUND'].includes(error.code)) {
      return true;
    }
    return false;
  }, []);

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
    isTerminalError: isTerminalStreamError,
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

  const getErrorMessage = (errMsg: string, code: string | null): string => {
    if (code && ERROR_MESSAGES[code]) {
      return t(ERROR_MESSAGES[code]);
    }
    return errMsg;
  };

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

  const isSessionActive = currentSession?.status === 'in_progress';
  const isTerminalError = errorCode === 'MAX_TURNS_REACHED' || errorCode === 'SESSION_COMPLETED';
  const streamingDraft = isStreaming
    ? buildLocalDraft({
        text: streamingText,
        status: streamingStatus ?? 'thinking',
      })
    : null;
  const activeDraft = mirroredDraft ?? streamingDraft ?? cancelledDraft;
  const recoveryBadgeText = t('interview.recoveringBadge');
  const draftFallbackText = activeDraft?.status === 'cancelled'
    ? t('interview.cancelled')
    : t('interview.thinking');

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
        {activeDraft && (
          <AIStreamingBubble
            text={activeDraft.text}
            fallbackText={draftFallbackText}
            status={activeDraft.status}
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
          description={(errorCode === 'RATE_LIMIT_EXCEEDED' || errorCode === 'TURN_TOO_FAST')
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
                ![
                  'NOT_FOUND',
                  'CONSENT_REQUIRED',
                  'RATE_LIMIT_EXCEEDED',
                  'TURN_TOO_FAST',
                  'MAX_TURNS_REACHED',
                  'SESSION_COMPLETED',
                  'AI_CALL_FAILED',
                  'CONCURRENT_REQUEST',
                  'CONNECTION_LOST',
                ].includes(errorCode || '') && (
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
            void cancelStream(sessionId);
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
