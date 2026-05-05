/**
 * 訪談結果頁面（遷移：Ant Spin/Typography/Button/Result/message → shadcn + Tailwind + sonner + Lucide）
 */

import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Info, AlertCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInterviewStore } from '@/store/interviewStore';
import FeedbackCardComponent from '@/components/business/Interview/FeedbackCard';
import type { FeedbackCard } from '@/types/interview';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';

const POLLING_INTERVAL_MS = 3000;
const POLLING_TIMEOUT_MS = 60_000;

const InterviewResult: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { currentSession, loading, error: storeError, getSession, retryFailed } = useInterviewStore();
  const [retrying, setRetrying] = useState(false);
  const retryLockRef = useRef(false);
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const pollingStartRef = useRef<number>(0);
  const mountedRef = useMountedRef();

  useEffect(() => {
    if (sessionId && (!currentSession || currentSession.id !== sessionId)) getSession(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (currentSession?.status === 'processing' && !pollingTimedOut) {
      if (pollingStartRef.current === 0) pollingStartRef.current = Date.now();
      let active = true;
      let consecutiveErrors = 0;
      const timer = setInterval(() => {
        if (!active) return;
        if (Date.now() - pollingStartRef.current >= POLLING_TIMEOUT_MS) { setPollingTimedOut(true); return; }
        if (sessionId) getSession(sessionId).then(() => { if (active) consecutiveErrors = 0; }).catch(() => { if (!active) return; consecutiveErrors++; if (consecutiveErrors >= 5) setPollingTimedOut(true); });
      }, POLLING_INTERVAL_MS);
      return () => { active = false; clearInterval(timer); };
    } else if (currentSession?.status !== 'processing') { pollingStartRef.current = 0; setPollingTimedOut(false); }
  }, [currentSession?.status, sessionId, pollingTimedOut]);

  if (loading && !currentSession) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t('interview.result.loading')}</p>
      </div>
    );
  }

  if (currentSession?.status === 'processing' && !pollingTimedOut) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">{t('interview.result.processingTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('interview.result.processingHint')}</p>
      </div>
    );
  }

  if (pollingTimedOut && currentSession?.status === 'processing') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <Info className="size-12 text-primary" />
        <h2 className="text-xl font-bold text-foreground">{t('interview.result.processingSlowTitle')}</h2>
        <p className="text-sm text-muted-foreground max-w-sm">{t('interview.result.processingSlowSub')}</p>
        <div className="flex gap-2">
          <Button onClick={() => { setPollingTimedOut(false); pollingStartRef.current = Date.now(); if (sessionId) getSession(sessionId); }}>{t('interview.result.keepWaiting')}</Button>
          <Button variant="outline" onClick={() => navigate('/profile/index')}>{t('interview.result.backProfile')}</Button>
        </div>
      </div>
    );
  }

  const handleRetry = async () => {
    if (!sessionId || retryLockRef.current) return;
    retryLockRef.current = true; setRetrying(true);
    try {
      await retryFailed(sessionId);
      if (!mountedRef.current) return;
      toast.info(t('interview.retryProcessing'));
      await getSession(sessionId);
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      toast.error(getErrorMessage(error, 'interview.retryFail'));
    } finally { retryLockRef.current = false; if (mountedRef.current) setRetrying(false); }
  };

  if (!currentSession && storeError && sessionId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertCircle className="size-12 text-destructive" />
        <h2 className="text-xl font-bold text-foreground">{t('interview.loadFail')}</h2>
        <p className="text-sm text-muted-foreground max-w-sm">{storeError}</p>
        <div className="flex gap-2">
          <Button onClick={() => sessionId && getSession(sessionId)} data-testid="interview-result-load-retry">{t('common.retry')}</Button>
          <Button variant="outline" onClick={() => navigate('/profile/index')}>{t('interview.result.backProfile')}</Button>
        </div>
      </div>
    );
  }

  if (currentSession?.status === 'processing_failed') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertTriangle className="size-12 text-warning" />
        <h2 className="text-xl font-bold text-foreground">{t('interview.result.failedTitle')}</h2>
        <p className="text-sm text-muted-foreground max-w-sm">{t('interview.result.failedSub')}</p>
        <div className="flex gap-2">
          <Button onClick={handleRetry} disabled={retrying}>{retrying && <Loader2 className="size-4 animate-spin" />}{t('interview.result.retry')}</Button>
          <Button variant="outline" onClick={() => navigate('/profile/index')}>{t('interview.result.backProfile')}</Button>
        </div>
      </div>
    );
  }

  let feedback: FeedbackCard | null = null;
  if (currentSession?.feedback_card) {
    try { feedback = JSON.parse(currentSession.feedback_card); } catch { feedback = null; }
  }

  if (!feedback) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <Info className="size-12 text-primary" />
        <h2 className="text-xl font-bold text-foreground">{t('interview.result.doneTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('interview.result.doneSub')}</p>
        <Button onClick={() => navigate('/profile/index')}>{t('interview.result.backProfile')}</Button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="mx-auto max-w-2xl px-4 py-8">
      <FeedbackCardComponent
        feedback={feedback}
        trigger={currentSession?.trigger}
        onViewProfile={() => navigate('/profile/my-story')}
        onGoHome={() => navigate('/')}
        onBackToCase={() => navigate('/case/create')}
        onBackToJudgment={() => navigate(-1)}
      />
    </motion.div>
  );
};

export default InterviewResult;
