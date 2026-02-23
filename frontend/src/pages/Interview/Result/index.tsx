import React, { useEffect, useState, useRef } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, Typography, Button, Result, message } from 'antd';
import { useInterviewStore } from '@/store/interviewStore';
import FeedbackCardComponent from '@/components/business/Interview/FeedbackCard';
import type { FeedbackCard } from '@/types/interview';
import { t } from '@/utils/i18n';
import './index.less';

const { Text } = Typography;

const POLLING_INTERVAL_MS = 3000;
const POLLING_TIMEOUT_MS = 60_000;

const InterviewResult: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { currentSession, loading, getSession, retryFailed } = useInterviewStore();
  const [retrying, setRetrying] = useState(false);
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const pollingStartRef = useRef<number>(0);
  const mountedRef = useMountedRef();

  useEffect(() => {
    if (sessionId && (!currentSession || currentSession.id !== sessionId)) {
      getSession(sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    if (currentSession?.status === 'processing' && !pollingTimedOut) {
      if (pollingStartRef.current === 0) {
        pollingStartRef.current = Date.now();
      }

      let active = true;
      let consecutiveErrors = 0;
      const timer = setInterval(() => {
        if (!active) return;
        const elapsed = Date.now() - pollingStartRef.current;
        if (elapsed >= POLLING_TIMEOUT_MS) {
          setPollingTimedOut(true);
          return;
        }
        if (sessionId) {
          getSession(sessionId)
            .then(() => { if (active) consecutiveErrors = 0; })
            .catch(() => {
              if (!active) return;
              consecutiveErrors++;
              if (consecutiveErrors >= 5) setPollingTimedOut(true);
            });
        }
      }, POLLING_INTERVAL_MS);

      return () => { active = false; clearInterval(timer); };
    } else if (currentSession?.status !== 'processing') {
      pollingStartRef.current = 0;
      setPollingTimedOut(false);
    }
  }, [currentSession?.status, sessionId, pollingTimedOut]);

  if (loading && !currentSession) {
    return (
      <div className="interview-result__loading">
        <Spin size="large" />
        <Text type="secondary">{t('interview.result.loading')}</Text>
      </div>
    );
  }

  if (currentSession?.status === 'processing' && !pollingTimedOut) {
    return (
      <div className="interview-result__loading">
        <Spin size="large" />
        <Text type="secondary">{t('interview.result.processingTitle')}</Text>
        <Text type="secondary">{t('interview.result.processingHint')}</Text>
      </div>
    );
  }

  if (pollingTimedOut && currentSession?.status === 'processing') {
    return (
      <div className="interview-result">
        <Result
          status="info"
          title={t('interview.result.processingSlowTitle')}
          subTitle={t('interview.result.processingSlowSub')}
          extra={
            <Button type="primary" onClick={() => {
              setPollingTimedOut(false);
              pollingStartRef.current = Date.now();
              if (sessionId) getSession(sessionId);
            }}>
              {t('interview.result.keepWaiting')}
            </Button>
          }
        />
      </div>
    );
  }

  const handleRetry = async () => {
    if (!sessionId) return;
    setRetrying(true);
    try {
      await retryFailed(sessionId);
      if (!mountedRef.current) return;
      message.info(t('interview.retryProcessing'));
      await getSession(sessionId);
    } catch {
      if (!mountedRef.current) return;
      message.error(t('interview.retryFail'));
    } finally {
      if (mountedRef.current) setRetrying(false);
    }
  };

  if (currentSession?.status === 'processing_failed') {
    return (
      <div className="interview-result">
        <Result
          status="warning"
          title={t('interview.result.failedTitle')}
          subTitle={t('interview.result.failedSub')}
          extra={
            <Button type="primary" loading={retrying} onClick={handleRetry}>
              {t('interview.result.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  let feedback: FeedbackCard | null = null;
  if (currentSession?.feedback_card) {
    try {
      feedback = JSON.parse(currentSession.feedback_card);
    } catch {
      feedback = null;
    }
  }

  if (!feedback) {
    return (
      <div className="interview-result">
        <Result
          status="info"
          title={t('interview.result.doneTitle')}
          subTitle={t('interview.result.doneSub')}
          extra={
            <Button type="primary" onClick={() => navigate('/profile/index')}>
              {t('interview.result.backProfile')}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="interview-result">
      <FeedbackCardComponent
        feedback={feedback}
        trigger={currentSession?.trigger}
        onViewProfile={() => navigate('/profile/my-story')}
        onGoHome={() => navigate('/')}
        onBackToCase={() => navigate('/case/create')}
        onBackToJudgment={() => navigate(-1)}
      />
    </div>
  );
};

export default InterviewResult;
