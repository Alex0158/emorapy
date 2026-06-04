/**
 * 訪談聊天主頁面
 *
 * 遷移: Ant Typography/Button/Spin/message/Icons → shadcn Button + Tailwind + sonner + Lucide
 * 保留: 所有業務邏輯（AI stream subscription, session lifecycle, canonical sync guard）
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  // Session bootstrapping
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

  // Auto-scroll
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
      toast.success(t('interview.endSuccess'));
      navigate(`/interview/${sessionId}/result`, { replace: true });
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      toast.error(getApiErrorMessage(error, 'interview.endFail'));
    } finally {
      endingRef.current = false;
    }
  }, [sessionId, endSession, navigate, isStreaming, cancelStream, mountedRef]);

  // Auto-end when shouldEnd is true
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

  const resolveVisibleErrorTitle = (code: string | null, fallbackMessage: string): string =>
    resolveInterviewErrorMessage(fallbackMessage, code, t);

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

  // P03 regression guard: canonical sync during streaming
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

  // Loading state
  if (loading && !currentSession) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">{t('interview.loadingChat')}</span>
      </div>
    );
  }

  // Initial load error
  if (initialLoadError && !currentSession) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center p-6">
        <AIErrorState
          className="w-full max-w-md"
          title={t('interview.loadFail')}
          description={initialLoadError}
          actions={(
            <Button size="sm" onClick={handleInitialLoadRetry} data-testid="interview-chat-load-retry">
              {t('common.retry')}
            </Button>
          )}
          footer={(
            <Button variant="ghost" size="sm" onClick={() => navigate('/profile/index')}>
              {t('interview.backToProfile')}
            </Button>
          )}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm">
        <button
          onClick={() => navigate('/profile/index')}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t('common.back')}
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h5 className="text-sm font-semibold text-foreground truncate">{t('interview.title')}</h5>
          <p className="text-xs text-muted-foreground truncate">
            {t('interview.domainsExplored').replace('{count}', String(currentSession?.domains_touched?.length || 0))}
            {turns.length > 1 && ` · ${t('interview.turnsProgress').replace('{count}', String(turns.length - 1))}`}
          </p>
        </div>
        {isSessionActive && turns.length >= 3 && (
          <Button variant="outline" size="sm" onClick={handleEnd}>
            {t('interview.pauseChat')}
          </Button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" role="log" aria-live="polite" aria-label={t('interview.messagesLog')}>
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
            wrapperClassName="flex gap-3 max-w-[85%]"
            itemClassName=""
            bodyClassName=""
            contentClassName="rounded-2xl px-4 py-3 text-sm leading-relaxed bg-card border border-border text-foreground rounded-tl-md shadow-xs"
            cursorClassName="ml-0.5 inline-block w-[2px] h-4 bg-current animate-[blink_1s_infinite]"
            thinkingClassName="text-muted-foreground"
            thinkingDotsClassName="animate-pulse"
            head={isRecoveringDraft ? (
              <AIRecoveryBadge
                text={recoveryBadgeText}
                className="mb-1"
              />
            ) : undefined}
            avatar={(
              <div className="shrink-0 pt-1">
                <MediatorAvatar size="small" />
              </div>
            )}
          />
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Safety Alert */}
      {safetyAlert && (
        <div className="px-4 pb-2">
          <SafetyAlert
            message={safetyAlert.message}
            severity={safetyAlert.severity}
            onDismiss={dismissSafetyAlert}
          />
        </div>
      )}

      {/* Error State */}
      {error && !safetyAlert && (
        <div className="px-4 pb-2">
          <AIErrorState
            title={resolveVisibleErrorTitle(errorCode, error)}
            description={shouldShowRateLimitHint(errorCode)
              ? t('interview.error.rateLimitHint')
              : undefined}
            actions={(
              <>
                {errorCode === 'MAX_TURNS_REACHED' && sessionId && (
                  <Button size="sm" onClick={handleEnd}>
                    {t('interview.viewResult')}
                  </Button>
                )}
                {errorCode === 'SESSION_COMPLETED' && sessionId && (
                  <Button size="sm" onClick={() => navigate(`/interview/${sessionId}/result`, { replace: true })}>
                    {t('interview.viewResult')}
                  </Button>
                )}
                {errorCode === 'NOT_FOUND' && (
                  <Button size="sm" variant="outline" onClick={() => navigate('/profile/index')}>
                    {t('interview.backToProfile')}
                  </Button>
                )}
                {errorCode === 'CONSENT_REQUIRED' && (
                  <Button size="sm" variant="outline" onClick={() => navigate('/profile/index')}>
                    {t('interview.backToProfile')}
                  </Button>
                )}
                {errorCode === 'AI_CALL_FAILED' && sessionId && (
                  <Button size="sm" variant="outline" onClick={handleReload}>
                    {t('interview.reloadConversation')}
                  </Button>
                )}
                {errorCode === 'CONCURRENT_REQUEST' && sessionId && (
                  <Button size="sm" variant="outline" onClick={handleReload}>
                    {t('interview.reloadConversation')}
                  </Button>
                )}
                {errorCode === 'CONNECTION_LOST' && sessionId && (
                  <Button size="sm" variant="outline" onClick={handleReload}>
                    {t('interview.reloadConversation')}
                  </Button>
                )}
                {sessionId &&
                  shouldShowFallbackReloadButton(errorCode) && (
                    <Button size="sm" variant="outline" onClick={handleReload} data-testid="interview-chat-reload-fallback">
                      {t('interview.reloadConversation')}
                    </Button>
                  )}
              </>
            )}
          />
        </div>
      )}

      {/* Input */}
      {isSessionActive && !isTerminalError && (
        <div className="shrink-0 border-t border-border bg-card/80 px-4 py-3 backdrop-blur-sm">
          <InterviewInput
            onSend={handleSend}
            onStop={() => {
              void cancelStream(sessionId).then(() => {
                toast.info(t('interview.cancelled'));
              });
            }}
            onSkip={handleSkip}
            disabled={loading}
            isStreaming={isStreaming}
            placeholder={t('interview.sendPlaceholder')}
          />
        </div>
      )}

      {/* Processing state */}
      {!isSessionActive && currentSession?.status === 'processing' && (
        <div className="flex shrink-0 items-center justify-center gap-3 border-t border-border bg-card px-4 py-4">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">{t('interview.processing')}</span>
          <Button
            variant="link"
            size="sm"
            onClick={() => navigate(`/interview/${sessionId}/result`, { replace: true })}
          >
            {t('interview.viewResult')}
          </Button>
        </div>
      )}

      {/* Completed state */}
      {currentSession?.status === 'completed' && (
        <div className="flex shrink-0 items-center justify-center border-t border-border bg-card px-4 py-4">
          <Button onClick={() => navigate(`/interview/${sessionId}/result`, { replace: true })}>
            {t('interview.viewResult')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default InterviewChat;
