/**
 * 審理中頁面
 *
 * 遷移: Ant Card/Button/Typography/Spin/Progress/Alert/Space/Icons/message → shadcn + Tailwind + sonner + Lucide
 * 保留: 所有業務邏輯（polling, retry judgment, case status routing）
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw, Loader2, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getCase } from '@/services/api/case';
import { getJudgmentByCaseId, generateJudgment } from '@/services/api/judgment';
import type { Case } from '@/types/case';
import type { Judgment } from '@/types/judgment';
import MediatorAvatar from '@/components/business/MediatorAvatar';
import SEO from '@/components/common/SEO';
import { usePolling } from '@/hooks/usePolling';
import { POLLING_INTERVAL } from '@/utils/constants';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import { logger } from '@/utils/logger';

const CaseReview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [case_, setCase_] = useState<Case | null>(null);
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [loadErrorTitle, setLoadErrorTitle] = useState<string | null>(null);
  const [loadErrorDescription, setLoadErrorDescription] = useState<string | null>(null);
  const mountedRef = useMountedRef();
  const retryLockRef = useRef(false);
  const fetchLockRef = useRef(false);
  const staleRef = useRef(false);

  useEffect(() => {
    staleRef.current = false;
    setCase_(null);
    setJudgment(null);
    if (id) fetchCase();
    return () => { staleRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchCase = async () => {
    if (!id || fetchLockRef.current) return;
    fetchLockRef.current = true;
    setLoading(true);
    try {
      const caseData = await getCase(id);
      if (staleRef.current) return;
      setLoadErrorTitle(null);
      setLoadErrorDescription(null);
      setCase_(caseData);
    } catch (error: unknown) {
      if (staleRef.current) return;
      const err = error as { code?: string; message?: string };
      if (err?.code === 'FORBIDDEN' || err?.code === 'HTTP_403') {
        const errorMessage = getErrorMessage(error, 'message.noPermissionViewCase');
        setLoadErrorTitle(t('message.noPermissionViewCase'));
        setLoadErrorDescription(errorMessage === t('message.noPermissionViewCase') ? null : errorMessage);
        toast.error(errorMessage);
        navigate('/case/list', { replace: true });
      } else if (err?.code === 'NOT_FOUND' || err?.code === 'HTTP_404') {
        setLoadErrorTitle(t('common.caseNotFound'));
        setLoadErrorDescription(null);
        toast.error(t('common.caseNotFound'));
      } else {
        const errorMessage = getErrorMessage(error, 'common.getCaseFail');
        setLoadErrorTitle(t('common.getCaseFail'));
        setLoadErrorDescription(errorMessage === t('common.getCaseFail') ? null : errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      fetchLockRef.current = false;
      if (!staleRef.current) setLoading(false);
    }
  };

  const fetchJudgment = async (): Promise<boolean> => {
    if (!id) return false;
    try {
      const judgmentData = await getJudgmentByCaseId(id);
      if (staleRef.current) return false;
      if (judgmentData) { setJudgment(judgmentData); return true; }
      return false;
    } catch (error: unknown) {
      if (staleRef.current) return false;
      const err = error as { code?: string };
      if (err?.code === 'JUDGMENT_NOT_FOUND' || err?.code === 'HTTP_404') return false;
      logger.error('Failed to fetch judgment', error);
      return false;
    }
  };

  const { startPolling, stopPolling, isPolling } = usePolling(fetchJudgment, POLLING_INTERVAL, (data) => data === true);

  useEffect(() => {
    if (!case_) return;
    if (case_.status === 'completed' || case_.status === 'judgment_failed') { fetchJudgment(); }
    else if (case_.status === 'submitted' || case_.status === 'in_progress') { startPolling(); }
    else if (case_.status === 'draft') { toast.warning(t('review.caseNotSubmitted')); navigate(`/case/${id}`, { replace: true }); }
    else if (case_.status === 'cancelled') { toast.warning(t('review.caseCancelled')); navigate(`/case/list`, { replace: true }); }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [case_, startPolling, stopPolling]);

  useEffect(() => { if (judgment) stopPolling(); }, [judgment, stopPolling]);

  const handleRetryJudgment = async () => {
    if (!id || retrying || retryLockRef.current) return;
    retryLockRef.current = true;
    setRetrying(true);
    try {
      const newJudgment = await generateJudgment(id);
      if (!mountedRef.current) return;
      setJudgment(newJudgment);
      toast.success(t('review.retrySuccess'));
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      const err = error as { code?: string };
      if (err?.code === 'JUDGMENT_EXISTS') {
        try {
          const judgmentData = await getJudgmentByCaseId(id);
          if (!mountedRef.current) return;
          if (judgmentData) setJudgment(judgmentData);
          else { toast.error(t('review.retryFail')); if (id) fetchCase(); }
        } catch (fetchErr: unknown) {
          if (!mountedRef.current) return;
          toast.error(getErrorMessage(fetchErr, 'review.retryFail'));
          if (id) fetchCase();
        }
      } else {
        toast.error(getErrorMessage(error, 'review.retryFail'));
        if (id) fetchCase();
      }
    } finally {
      retryLockRef.current = false;
      if (mountedRef.current) setRetrying(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  // Case not found / error
  if (!case_) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-foreground">{loadErrorTitle || t('common.caseNotFound')}</p>
              {loadErrorDescription && <p className="mt-1 text-sm text-muted-foreground">{loadErrorDescription}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/case/list')}>{t('caseDetail.backList')}</Button>
            <Button size="sm" onClick={() => id && fetchCase()}>{t('common.retry')}</Button>
          </div>
        </div>
      </div>
    );
  }

  // Judgment ready
  if (judgment) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border border-success/30 bg-success/5 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 size-5 text-success" />
            <div>
              <p className="font-medium text-foreground">{t('review.judgmentReady')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('review.judgmentReadyDesc')}</p>
            </div>
          </div>
          <Button onClick={() => navigate(`/judgment/${judgment.id}`)}>{t('review.viewJudgment')}</Button>
        </div>
      </div>
    );
  }

  // Judgment failed
  if (case_.status === 'judgment_failed') {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 text-destructive" />
            <div>
              <p className="font-medium text-foreground">{t('review.judgmentFailed')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{case_.judgment_failure_reason || t('review.judgmentFailedDesc')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRetryJudgment} disabled={retrying}>
              {retrying ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {t('review.retryJudgment')}
            </Button>
            <Button variant="outline" onClick={() => navigate(`/case/${id}`)}>
              <ArrowLeft className="size-4" />
              {t('review.backToCase')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Polling / reviewing state
  return (
    <>
      <SEO title={t('review.title')} description={t('review.description')} />
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="mx-auto max-w-lg px-4 py-12 text-center" role="main" aria-label={t('review.pageLabel')}>
        <MediatorAvatar size="large" animated />
        <h2 className="mt-6 text-2xl font-bold text-foreground font-heading">{t('review.aiReviewing')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('review.analyzingHint')}</p>

        <div className="mt-8 rounded-xl border border-border bg-card p-6 space-y-6">
          <div>
            <Progress value={isPolling ? 65 : 100} className="h-2" />
            <p className="mt-3 text-sm text-muted-foreground">
              {isPolling ? t('review.aiAnalyzing') : t('review.done')}
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-primary-light/30 p-3 text-left">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-medium text-foreground">{t('review.etaTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('review.etaDesc')}</p>
            </div>
          </div>

          <div className="text-left">
            <span className="text-sm font-medium text-foreground">{t('review.caseTitle')}：</span>
            <span className="text-sm text-muted-foreground">{case_.title}</span>
          </div>
        </div>

        <div className="mt-6">
          <Button variant="ghost" onClick={() => navigate(`/case/${id}`)}>
            <ArrowLeft className="size-4" />
            {t('review.backToCase')}
          </Button>
        </div>
      </motion.div>
    </>
  );
};

export default CaseReview;
