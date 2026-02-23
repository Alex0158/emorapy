import React, { useEffect, useRef, useCallback } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Spin, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import ChatBubble from '@/components/business/Interview/ChatBubble';
import InterviewInput from '@/components/business/Interview/InterviewInput';
import SafetyAlert from '@/components/business/Interview/SafetyAlert';
import { useInterviewStore } from '@/store/interviewStore';
import { t } from '@/utils/i18n';
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

  const {
    currentSession,
    turns,
    streamingText,
    isStreaming,
    loading,
    error,
    errorCode,
    shouldEnd,
    safetyAlert,
    respond,
    skipTurn,
    getSession,
    endSession,
    cancelStream,
    dismissSafetyAlert,
  } = useInterviewStore();

  useEffect(() => {
    let stale = false;
    if (sessionId) {
      getSession(sessionId).catch(() => {
        if (stale) return;
        message.error(t('interview.loadFail'));
        navigate('/profile/index');
      });
    }
    return () => {
      stale = true;
      cancelStream();
    };
  }, [sessionId, cancelStream]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, streamingText]);

  useEffect(() => {
    if (shouldEnd && sessionId && currentSession?.status === 'in_progress' && !isStreaming) {
      handleEnd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldEnd, isStreaming, sessionId, currentSession?.status]);

  const handleSend = useCallback(async (msg: string) => {
    if (!sessionId) return;
    try {
      await respond(sessionId, msg);
    } catch {
      // Error handled in store
    }
  }, [sessionId, respond]);

  const handleSkip = useCallback(async () => {
    if (!sessionId) return;
    try {
      await skipTurn(sessionId);
    } catch {
      // Error handled in store
    }
  }, [sessionId, skipTurn]);

  const endingRef = useRef(false);
  const handleEnd = useCallback(async () => {
    if (!sessionId || endingRef.current) return;
    endingRef.current = true;
    try {
      if (isStreaming) {
        cancelStream();
      }
      await endSession(sessionId);
      if (!mountedRef.current) return;
      message.success(t('interview.endSuccess'));
      navigate(`/interview/${sessionId}/result`, { replace: true });
    } catch {
      if (!mountedRef.current) return;
      message.error(t('interview.endFail'));
    } finally {
      endingRef.current = false;
    }
  }, [sessionId, endSession, navigate, isStreaming, cancelStream, mountedRef]);

  const getErrorMessage = (errMsg: string, code: string | null): string => {
    if (code && ERROR_MESSAGES[code]) {
      return t(ERROR_MESSAGES[code]);
    }
    return errMsg;
  };

  const isSessionActive = currentSession?.status === 'in_progress';
  const isTerminalError = errorCode === 'MAX_TURNS_REACHED' || errorCode === 'SESSION_COMPLETED';

  if (loading && !currentSession) {
    return (
      <div className="interview-chat__loading">
        <Spin size="large" />
        <Text type="secondary">{t('interview.loadingChat')}</Text>
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
        {isStreaming && streamingText && (
          <ChatBubble
            content={streamingText}
            isUser={false}
            isStreaming={true}
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
        <div className="interview-chat__error">
          <Text type="danger">{getErrorMessage(error, errorCode)}</Text>
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
          {(errorCode === 'RATE_LIMIT_EXCEEDED' || errorCode === 'TURN_TOO_FAST') && (
            <Text type="secondary">{t('interview.error.rateLimitHint')}</Text>
          )}
          {errorCode === 'AI_CALL_FAILED' && sessionId && (
            <Button size="small" onClick={() => getSession(sessionId)}>
              {t('interview.reloadConversation')}
            </Button>
          )}
          {errorCode === 'CONCURRENT_REQUEST' && sessionId && (
            <Button size="small" onClick={() => getSession(sessionId)}>
              {t('interview.reloadConversation')}
            </Button>
          )}
          {errorCode === 'CONNECTION_LOST' && sessionId && (
            <Button size="small" onClick={() => getSession(sessionId)}>
              {t('interview.reloadConversation')}
            </Button>
          )}
        </div>
      )}

      {isSessionActive && !isTerminalError && (
        <InterviewInput
          onSend={handleSend}
          onStop={cancelStream}
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
