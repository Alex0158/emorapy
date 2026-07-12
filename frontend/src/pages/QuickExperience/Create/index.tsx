/**
 * 快速體驗 - 創建案件頁面
 *
 * 遷移: Legacy button/progress/alert/message controls → shadcn/ui + Tailwind + sonner
 * 保留: StatementInput, FileUpload 業務組件
 * 保留: 所有業務邏輯（session, draft, auto-save, submit, evidence upload）
 */

import { useState, useEffect, useRef } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/utils/logger';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { X, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useSessionStore } from '@/store/sessionStore';
import { useCaseStore } from '@/store/caseStore';
import { validateStatement } from '@/utils/validate';
import { localStore, sessionStorage, caseSessionMap } from '@/utils/storage';
import type { UploadFile } from '@/types/upload';
import SEO from '@/components/common/SEO';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import { YourPerspectiveStep } from './components/YourPerspectiveStep';
import { OtherPerspectiveStep } from './components/OtherPerspectiveStep';
import { EvidenceStep } from './components/EvidenceStep';

const DRAFT_STORAGE_KEY = 'quick_case_draft';

interface CaseDraft {
  plaintiffStatement: string;
  defendantStatement: string;
  evidenceUrls: string[];
}

const QuickExperienceCreate = () => {
  const navigate = useNavigate();
  const { session, createSession, setSession } = useSessionStore();
  const { createQuickCase, isLoading } = useCaseStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [plaintiffStatement, setPlaintiffStatement] = useState('');
  const [defendantStatement, setDefendantStatement] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<UploadFile[]>([]);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | null>(null);
  const [recoveredCase, setRecoveredCase] = useState<{ id: string; status: string } | null>(null);
  const [sessionInitError, setSessionInitError] = useState<string | null>(null);
  const [isRetryingSession, setIsRetryingSession] = useState(false);

  const submitLockRef = useRef(false);
  const mountedRef = useMountedRef();

  const ensureSession = async (isManualRetry = false) => {
    if (isManualRetry && mountedRef.current) {
      setIsRetryingSession(true);
    }
    try {
      await createSession();
      if (mountedRef.current) setSessionInitError(null);
    } catch (error) {
      logger.warn('Failed to create session', error);
      if (mountedRef.current) setSessionInitError(t('quickCreate.sessionInitWeakWarning'));
    } finally {
      if (isManualRetry && mountedRef.current) setIsRetryingSession(false);
    }
  };

  useEffect(() => {
    const existingSessionId = sessionStorage.get() || session?.session_id;
    if (!existingSessionId) {
      createSession()
        .then(() => { if (mountedRef.current) setSessionInitError(null); })
        .catch((error: unknown) => {
          logger.warn('Failed to create session', error);
          if (mountedRef.current) setSessionInitError(t('quickCreate.sessionInitWeakWarning'));
        });
    }
  }, [session, createSession, mountedRef]);

  const sessionId = session?.session_id ?? sessionStorage.get();
  useEffect(() => {
    if (!sessionId) return;
    const checkRecoveredCase = async () => {
      try {
        const { getCaseBySessionId } = await import('@/services/api/case');
        const existingCase = await getCaseBySessionId(sessionId);
        if (existingCase && existingCase.status === 'draft' && mountedRef.current) {
          setRecoveredCase({ id: existingCase.id, status: existingCase.status });
        }
      } catch (error) {
        logger.warn('Failed to check recovered case', error);
      }
    };
    checkRecoveredCase();
  }, [sessionId]);

  useEffect(() => {
    const draft = localStore.get<CaseDraft>(DRAFT_STORAGE_KEY);
    if (draft) {
      setPlaintiffStatement(draft.plaintiffStatement || '');
      setDefendantStatement(draft.defendantStatement || '');
    }
  }, []);

  useEffect(() => {
    if (!plaintiffStatement && !defendantStatement) {
      localStore.remove(DRAFT_STORAGE_KEY);
      setAutoSaveStatus(null);
      return;
    }
    setAutoSaveStatus('saving');
    const timer = setTimeout(() => {
      localStore.set(DRAFT_STORAGE_KEY, { plaintiffStatement, defendantStatement, evidenceUrls: [] });
      if (mountedRef.current) {
        setAutoSaveStatus('saved');
        setTimeout(() => { if (mountedRef.current) setAutoSaveStatus(null); }, 2000);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [plaintiffStatement, defendantStatement, mountedRef]);

  const canSubmit = validateStatement(plaintiffStatement).valid;

  const handleSubmit = async () => {
    if (submitLockRef.current) return;
    if (!canSubmit) {
      toast.warning(t('message.completePlaintiff'));
      return;
    }
    submitLockRef.current = true;
    try {
      if (!sessionStorage.get() && !session?.session_id) {
        await ensureSession();
      }
      const result = await createQuickCase({
        plaintiff_statement: plaintiffStatement.trim(),
        defendant_statement: defendantStatement.trim() || '',
        evidence_urls: [],
      });
      if (!result?.case?.id) throw new Error(t('message.submitFail'));

      if (result.session_id) {
        sessionStorage.set(result.session_id);
        caseSessionMap.set(result.case.id, result.session_id);
        if (result.session_expires_at) {
          setSession({ session_id: result.session_id, expires_at: result.session_expires_at });
        }
      }

      const filesToUpload = evidenceFiles
        .filter((f): f is UploadFile & { originFileObj: File } => Boolean(f?.originFileObj))
        .map((f) => f.originFileObj);

      if (filesToUpload.length > 0) {
        try {
          const { uploadEvidence } = await import('@/services/api/case');
          const sessionIdToUse = result.session_id || sessionStorage.get() || session?.session_id;
          if (sessionIdToUse) await uploadEvidence(result.case.id, filesToUpload as File[], sessionIdToUse);
        } catch {
          try { localStorage.setItem(`pending_evidence_${result.case.id}`, 'true'); } catch { /* noop */ }
        }
      }

      localStore.remove(DRAFT_STORAGE_KEY);
      if (mountedRef.current) navigate(`/quick-experience/result/${result.case.id}`);
    } catch (error: unknown) {
      if (mountedRef.current) toast.error(getErrorMessage(error, 'message.submitFail'));
    } finally {
      submitLockRef.current = false;
    }
  };

  const handleNextStep = () => {
    if (currentStep === 0 && !canSubmit) {
      toast.warning(t('message.completePlaintiff'));
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 2));
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  return (
    <>
      <SEO title={t('quickCreate.title')} description={t('quickCreate.description')} keywords={t('quickCreate.keywords')} />

      <div className="min-h-[calc(100vh-4rem)] bg-background px-5 py-8 md:py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-5 border-b border-border pb-6">
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t('quickCreate.close')}
            >
              <X className="size-4" />
              {t('quickCreate.exit')}
            </button>
            <div className="flex min-w-[220px] items-center gap-4">
              <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t('quickCreate.stepCount').replace('{current}', String(currentStep + 1)).replace('{total}', '3')}
              </span>
              <Progress value={((currentStep + 1) / 3) * 100} className="h-1.5 flex-1" />
              <span className="min-w-16 text-right text-xs text-muted-foreground" aria-live="polite">
                {autoSaveStatus === 'saving' && t('quickCreate.autoSaving')}
                {autoSaveStatus === 'saved' && t('quickCreate.autoSaved')}
              </span>
            </div>
          </div>

          {recoveredCase && (
            <div className="mt-6 flex flex-col gap-3 border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium text-foreground">{t('quickCreate.recoveredCase.title')}</span>
              <Button size="sm" onClick={() => navigate(`/quick-experience/result/${recoveredCase.id}`)}>
                {t('quickCreate.recoveredCase.continue')}
              </Button>
            </div>
          )}

          {sessionInitError && (
            <div className="mt-6 flex flex-col gap-4 border border-warning/40 p-4 sm:flex-row sm:items-start">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{sessionInitError}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('quickCreate.sessionInitWeakHint')}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void ensureSession(true)} disabled={isRetryingSession}>
                {isRetryingSession && <Loader2 className="size-3 animate-spin" />}
                {t('quickCreate.sessionInitRetry')}
              </Button>
            </div>
          )}

          <div className="grid gap-10 py-10 md:grid-cols-[180px_minmax(0,720px)] md:justify-center md:py-16">
            <aside className="border-b border-border pb-5 md:border-b-0 md:border-l md:pb-0 md:pl-5" aria-label={t('quickCreate.guide.title')}>
              <ol className="grid grid-cols-3 gap-2 md:block md:space-y-5">
                {(['step1', 'step2', 'step3'] as const).map((step, index) => (
                  <li key={step} className={index === currentStep ? 'text-foreground' : 'text-muted-foreground'}>
                    <button
                      type="button"
                      onClick={() => index < currentStep && setCurrentStep(index)}
                      disabled={index > currentStep}
                      className="min-h-11 text-left text-xs disabled:cursor-default md:text-sm"
                      aria-current={index === currentStep ? 'step' : undefined}
                    >
                      <span className="mr-2 font-heading text-primary">0{index + 1}</span>
                      {t(`quickCreate.${step}.nav`)}
                    </button>
                  </li>
                ))}
              </ol>
              <div className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground md:mt-8 md:pt-5">
                <ShieldCheck className="mb-2 size-4 text-secondary" aria-hidden="true" />
                {t('quickCreate.scopeNote')}
              </div>
            </aside>

            <div id="quick-input-area">
              <AnimatePresence mode="wait">
                {currentStep === 0 && (
                  <YourPerspectiveStep
                    value={plaintiffStatement}
                    canContinue={canSubmit}
                    onChange={setPlaintiffStatement}
                    onNext={handleNextStep}
                  />
                )}
                {currentStep === 1 && (
                  <OtherPerspectiveStep
                    value={defendantStatement}
                    onChange={setDefendantStatement}
                    onPrevious={handlePrevStep}
                    onNext={handleNextStep}
                    onCollaborative={() => navigate('/quick-experience/collaborative')}
                  />
                )}
                {currentStep === 2 && (
                  <EvidenceStep
                    files={evidenceFiles}
                    isSubmitting={isLoading}
                    onChange={setEvidenceFiles}
                    onPrevious={handlePrevStep}
                    onSubmit={handleSubmit}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default QuickExperienceCreate;
