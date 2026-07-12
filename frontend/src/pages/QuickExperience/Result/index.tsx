/**
 * 快速體驗 - 關係梳理結果頁面
 */

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAIStreamSubscription } from '@/hooks/useAIStreamSubscription';
import AIErrorState from '@/components/common/AIErrorState';
import { useJudgmentStore } from '@/store/judgmentStore';
import { getJudgmentByCaseId } from '@/services/api/judgment';
import { getCase, uploadEvidence } from '@/services/api/case';
import type { Judgment } from '@/types/judgment';
import { usePolling } from '@/hooks/usePolling';
import { POLLING_INTERVAL } from '@/utils/constants';
import { useSessionStore } from '@/store/sessionStore';
import { sessionStorage, caseSessionMap } from '@/utils/storage';
import SEO from '@/components/common/SEO';
import { logger } from '@/utils/logger';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';

import AIAnalyzingAnimation from './components/AIAnalyzingAnimation';
import ResultHeader from './components/ResultHeader';
import SummarySection from './components/SummarySection';
import ResponsibilitySection from './components/ResponsibilitySection';
import JudgmentSection from './components/JudgmentSection';
import EvidenceUploadSection from './components/EvidenceUploadSection';
import {
  canUploadEvidenceForCaseStatus,
  getEvidenceUploadStatusFromCase,
  getPendingEvidenceStorageKey,
  getResponsibilityRatio,
  isJudgmentFailedState,
  isPendingJudgmentErrorCode,
  isSessionJudgmentErrorCode,
  resolveQuickResultSessionId,
  shouldShowResponsibilityRatio as shouldRenderResponsibilityRatio,
  storageGetItem,
  storageRemoveItem,
  storageSetItem,
  type EvidenceUploadStatus,
} from './resultUtils';

const QuickExperienceResult = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, error } = useJudgmentStore();
  const mountedRef = useMountedRef();

  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [judgmentError, setJudgmentError] = useState<string | null>(null);
  const [judgmentErrorCode, setJudgmentErrorCode] = useState<string | null>(null);
  const [caseStatus, setCaseStatus] = useState<string | null>(null);
  const [judgmentFailureReason, setJudgmentFailureReason] = useState<string | null>(null);
  const [evidenceUploadStatus, setEvidenceUploadStatus] = useState<EvidenceUploadStatus>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const { session } = useSessionStore();
  const pollingEverStartedRef = useRef(false);
  const stopPollingRef = useRef<(() => void) | null>(null);
  const retryJudgmentLockRef = useRef(false);
  const sessionJudgmentErrorHandledRef = useRef(false);

  const caseMappedSessionId = id ? caseSessionMap.get(id) : null;
  const globalSessionId = id && !caseMappedSessionId ? sessionStorage.get() : null;
  const storeSessionId = id && !caseMappedSessionId && !globalSessionId ? session?.session_id : null;
  const caseSessionId = id
    ? resolveQuickResultSessionId({
        caseSessionId: caseMappedSessionId,
        globalSessionId,
        storeSessionId,
      })
    : null;
  const registerTargetState = useMemo(
    () => ({ from: { pathname: location.pathname } }),
    [location.pathname]
  );

  useAIStreamSubscription<null>({
    scopeType: 'case_judgment',
    scopeId: judgment ? null : id,
    enabled: !!id && !judgment,
    initialState: null,
    reduceReady: () => null,
    reduceEvent: () => null,
    onEvent: (event) => {
      if (event.eventType === 'stream.persisted') {
        void fetchJudgment();
      }
      if (event.eventType === 'stream.failed' && event.error) {
        setJudgmentError(getErrorMessage(event.error, 'message.judgmentRetryHint'));
        setJudgmentErrorCode(event.error.code);
      }
    },
  });

  const fetchJudgment = useCallback(async (): Promise<Judgment | null> => {
    if (sessionJudgmentErrorHandledRef.current) return null;

    if (!id) {
      if (mountedRef.current) {
        toast.error(t('message.caseIdMissing'));
        navigate('/quick-experience/create');
      }
      return null;
    }

    try {
      const judgmentData = await getJudgmentByCaseId(id, caseSessionId ?? undefined);
      if (!mountedRef.current) return judgmentData;
      if (judgmentData) {
        setJudgment(judgmentData);
        return judgmentData;
      }
      return null;
    } catch (error: unknown) {
      if (!mountedRef.current) return null;
      const err = error as { code?: string; message?: string };
      if (isPendingJudgmentErrorCode(err.code)) {
        return null;
      }
      if (err.code === 'JUDGMENT_FAILED') {
        setJudgmentErrorCode('JUDGMENT_FAILED');
        setJudgmentError(getErrorMessage(error, 'message.judgmentRetryHint'));
        stopPollingRef.current?.();
        return null;
      }
      if (isSessionJudgmentErrorCode(err.code)) {
        sessionJudgmentErrorHandledRef.current = true;
        setJudgmentErrorCode(err.code as string);
        setJudgmentError(getErrorMessage(error, 'error.session.expiredHint'));
        stopPollingRef.current?.();
        return null;
      }
      logger.error('Failed to fetch judgment', error);
      setJudgmentErrorCode(err.code ?? 'UNKNOWN');
      setJudgmentError(getErrorMessage(error, 'message.getJudgmentFail'));
      stopPollingRef.current?.();
      return null;
    }
  }, [caseSessionId, id, mountedRef, navigate]);

  const responsibilityRatioMemo = useMemo(() => getResponsibilityRatio(judgment), [judgment]);
  const shouldShowResponsibilityRatio = shouldRenderResponsibilityRatio(judgment);

  const { startPolling, stopPolling, isPolling } = usePolling(
    fetchJudgment,
    POLLING_INTERVAL,
    (data) => data !== null,
    { maxAttempts: 30, maxDuration: 5 * 60 * 1000, exponentialBackoff: true, initialInterval: POLLING_INTERVAL, maxInterval: 30 * 1000 }
  );
  stopPollingRef.current = stopPolling;

  const fetchCase = async () => {
    const caseId = id as string;
    try {
      const case_ = await getCase(caseId, caseSessionId ?? undefined);
      if (!mountedRef.current) return case_;
      const status = case_.status;
      setCaseStatus(status);
      if (status === 'judgment_failed' && case_.judgment_failure_reason) {
        setJudgmentFailureReason(case_.judgment_failure_reason);
      }

      const pendingEvidenceKey = getPendingEvidenceStorageKey(caseId);
      if (!canUploadEvidenceForCaseStatus(status)) {
        setEvidenceUploadStatus(null);
        storageRemoveItem(pendingEvidenceKey);
        return case_;
      }

      setEvidenceUploadStatus(getEvidenceUploadStatusFromCase(case_, Boolean(storageGetItem(pendingEvidenceKey))));
      return case_;
    } catch (error) {
      if (!mountedRef.current) return null;
      const err = error as { code?: string };
      if (err?.code === 'NOT_FOUND' || err?.code === 'HTTP_404') {
        caseSessionMap.remove(caseId);
        toast.warning(t('message.caseNotFoundOrExpired'));
        navigate('/quick-experience/create', { replace: true });
        return null;
      }
      logger.error('Failed to fetch case', error);
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (id) fetchCase().then(c => {
      if (cancelled) return;
      if (c?.status === 'judgment_failed') {
        setJudgmentErrorCode('JUDGMENT_FAILED');
        setJudgmentError(t('message.judgmentRetryHint'));
        stopPolling();
      }
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, stopPolling]);

  const handleRetryJudgment = async () => {
    if (retryJudgmentLockRef.current) return;
    retryJudgmentLockRef.current = true;
    const caseId = id as string;
    setJudgmentError(null); setJudgmentErrorCode(null); setJudgmentFailureReason(null); setJudgment(null);
    try {
      const { generateJudgment } = await import('@/services/api/judgment');
      await generateJudgment(caseId, caseSessionId ?? undefined);
      if (!mountedRef.current) return;
      toast.success(t('message.judgmentRegenSuccess'));
      startPolling();
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      const msg = getErrorMessage(error, 'message.retryFail');
      toast.error(msg);
      setJudgmentError(msg);
    } finally {
      retryJudgmentLockRef.current = false;
    }
  };

  const handleEvidenceUpload = async (fileList: File[]) => {
    const caseId = id as string;
    const filesToUpload = fileList.filter((file) => file instanceof File);
    if (filesToUpload.length === 0) return toast.warning(t('message.selectFile'));

    setIsUploading(true); setEvidenceUploadStatus('pending');
    try {
      const fallbackSessionId = caseSessionId ? null : sessionStorage.get();
      const sessionIdToUse = resolveQuickResultSessionId({
        caseSessionId,
        globalSessionId: fallbackSessionId,
        storeSessionId: fallbackSessionId ? null : session?.session_id,
      });
      if (!sessionIdToUse) {
        if (mountedRef.current) {
          toast.error(t('message.sessionIdMissing'));
          setEvidenceUploadStatus('failed');
          setIsUploading(false);
        }
        return;
      }
      await uploadEvidence(caseId, filesToUpload, sessionIdToUse);
      if (!mountedRef.current) return;
      toast.success(t('message.evidenceUploadSuccess'));
      setEvidenceUploadStatus('success');
      storageRemoveItem(getPendingEvidenceStorageKey(caseId));
      try {
        await fetchCase();
      } catch (refreshErr) {
        logger.error('Failed to refresh case after evidence upload', refreshErr);
      }
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      toast.error(getErrorMessage(error, 'message.evidenceUploadFail'));
      setEvidenceUploadStatus('failed');
      storageSetItem(getPendingEvidenceStorageKey(caseId), 'true');
    } finally {
      if (mountedRef.current) setIsUploading(false);
    }
  };

  useEffect(() => {
    setJudgment(null);
    setJudgmentError(null);
    setJudgmentErrorCode(null);
    setJudgmentFailureReason(null);
    setCaseStatus(null);
    setEvidenceUploadStatus(null);
    sessionJudgmentErrorHandledRef.current = false;
    pollingEverStartedRef.current = false;
    fetchJudgment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    if (!judgment && id && !judgmentError && caseStatus !== 'judgment_failed') {
      pollingEverStartedRef.current = true;
      startPolling();
    } else stopPolling();
    return () => stopPolling();
  }, [judgment, id, judgmentError, caseStatus, startPolling, stopPolling]);

  if (isLoading && !judgment) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10 text-center">
        <AIAnalyzingAnimation />
      </div>
    );
  }

  if (error && !judgment) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10 text-center">
      <AIErrorState
        title={t('error.fetch.title')}
        description={error}
        footer={(
          <Button variant="outline" onClick={() => navigate('/quick-experience/create')} className="mt-6">
            {t('error.back')}
          </Button>
        )}
      />
    </div>
  );

  if (judgmentError !== null || caseStatus === 'judgment_failed') {
    const isSessionExpired = isSessionJudgmentErrorCode(judgmentErrorCode);
    const isJudgmentFailed = isJudgmentFailedState(judgmentErrorCode, caseStatus);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10 text-center">
        <AIErrorState
          title={isSessionExpired ? t('error.session.title') : isJudgmentFailed ? t('error.judgment.title') : t('error.fetch.title')}
          description={isJudgmentFailed && judgmentFailureReason ? `${t('error.judgment.failureReasonPrefix')}${judgmentFailureReason}` : judgmentError || (isSessionExpired ? t('error.session.expiredHint') : t('message.retryOrLater'))}
          actions={
            isSessionExpired ? (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => navigate('/auth/login', { state: registerTargetState })}>
                  {t('auth.login.submit')}
                </Button>
                <Button onClick={() => navigate('/auth/register', { state: registerTargetState })}>
                  {t('register.action.now')}
                </Button>
                <Button onClick={() => navigate('/quick-experience/create')}>
                  {t('result.restart')}
                </Button>
              </div>
            )
            : isJudgmentFailed ? <Button onClick={handleRetryJudgment}>{t('error.retry')}</Button>
            : <Button onClick={() => { setJudgmentError(null); setJudgmentErrorCode(null); pollingEverStartedRef.current = true; startPolling(); }}>{t('error.retry')}</Button>
          }
          footer={(
            <Button variant="outline" onClick={() => navigate('/quick-experience/create')} className="mt-6">
              {t('error.back')}
            </Button>
          )}
        />
      </div>
    );
  }

  if (!judgment) {
    const isTimeout = pollingEverStartedRef.current && !isPolling;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10 text-center">
        {isTimeout ? (
          <AIErrorState
            title={t('pending.long.message')}
            description={t('pending.long.desc')}
            type="warning"
            actions={
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { pollingEverStartedRef.current = true; startPolling(); }}>{t('pending.long.action.wait')}</Button>
                <Button onClick={handleRetryJudgment}>{t('pending.long.action.regen')}</Button>
                <Button onClick={() => navigate('/quick-experience/create')}>{t('pending.long.action.back')}</Button>
              </div>
            }
          />
        ) : <AIAnalyzingAnimation />}
      </div>
    );
  }

  const seoDescription = shouldShowResponsibilityRatio
    ? `${t('responsibility.title')}: ${t('quickCreate.roleA')} ${responsibilityRatioMemo.plaintiff}%, ${t('quickCreate.roleB')} ${responsibilityRatioMemo.defendant}%`
    : t('result.subtitle');

  return (
    <>
      <SEO
        title={t('result.title')}
        description={seoDescription}
        keywords={t('result.keywords')}
      />
      <div className="min-h-screen bg-background pb-16">
        <a href="#judgment-section" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:text-white focus:px-6 focus:py-3 focus:font-semibold">{t('result.skipToJudgment')}</a>

        <div className="mx-auto max-w-[900px] px-5 py-10 md:py-16">
          <ResultHeader />
          <div className="mt-10">
            <SummarySection summary={judgment.summary} />
          </div>
          {shouldShowResponsibilityRatio && <ResponsibilitySection ratio={responsibilityRatioMemo} />}
          {judgment.judgment_content && <JudgmentSection content={judgment.judgment_content} />}

          <EvidenceUploadSection status={evidenceUploadStatus} caseId={id as string} isUploading={isUploading} onUploadFiles={handleEvidenceUpload} />

          <section className="mt-10 border-t border-border pt-8" aria-label={t('result.ariaActions')}>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t('result.scopeNote')}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={() => navigate('/auth/register', { state: registerTargetState })}
                className="px-8 text-base"
              >
                <Lock className="size-4" /> {t('register.action.now')}
              </Button>
              <button
                type="button"
                onClick={() => navigate('/auth/login', { state: registerTargetState })}
                className="min-h-11 px-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                {t('auth.login.submit')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/quick-experience/create')}
                className="min-h-11 px-3 text-sm font-semibold text-muted-foreground underline decoration-border underline-offset-8 hover:text-foreground hover:decoration-primary"
              >
                {t('quickCreate.recoveredCase.startNew')}
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default QuickExperienceResult;
