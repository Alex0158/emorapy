/**
 * 案件創建頁面 — 多步驟精靈
 *
 * 遷移: Legacy card/form controls → shadcn + Tailwind + sonner
 * 重構: 3 堆疊 Card → typeform 風格多步驟精靈（漸進式揭露）
 * 保留: 所有業務邏輯（pairing, interview trigger, consent, evidence upload, submit）
 * 保留: StatementInput, FileUpload, ConsentModal 業務組件
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { CelebrationOverlay, useCelebration } from '@/components/common/CelebrationOverlay';
import { Loader2, ArrowLeft, Info, Heart, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { getPairingStatus } from '@/services/api/pairing';
import { createCase } from '@/services/api/case';
import { psychProfileApi } from '@/services/api/psychProfile';
import { validateStatement } from '@/utils/validate';
import { useInterviewTrigger } from '@/hooks/useInterviewTrigger';
import MediatorAvatar from '@/components/business/MediatorAvatar';
import StatementInput from '@/components/business/StatementInput';
import ConsentModal from '@/components/business/Interview/ConsentModal';
import type { UploadFile } from '@/types/upload';
import FileUpload from '@/components/business/FileUpload';
import SEO from '@/components/common/SEO';
import { cn } from '@/lib/utils';
import { t } from '@/utils/i18n';
import { getErrorMessage } from '@/utils/apiError';

const PRE_CASE_RICHNESS_THRESHOLD = 0.3;

const stepVariants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
};

const CaseCreate = () => {
  const navigate = useNavigate();
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [pairingStatus, setPairingStatus] = useState<'loading' | 'pending' | 'active'>('loading');
  const [pairingLoadError, setPairingLoadError] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'remote' | 'collaborative'>('remote');
  const [plaintiffStatement, setPlaintiffStatement] = useState('');
  const [defendantStatement, setDefendantStatement] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<UploadFile[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPreCaseBanner, setShowPreCaseBanner] = useState(false);

  const mountedRef = useMountedRef();
  const submitLockRef = useRef(false);
  const { celebrating, celebrate, onComplete: onCelebrationComplete } = useCelebration();

  const {
    triggerInterview: handlePreCaseChat,
    consentOpen,
    setConsentOpen,
    setProfileConsent,
    handleConsent,
    consentLoading,
  } = useInterviewTrigger('pre_case');

  // --- Pairing Check ---
  const checkPairing = useCallback(async () => {
    setPairingLoadError(null);
    try {
      const pairing = await getPairingStatus();
      if (!mountedRef.current) return;
      if (pairing && pairing.status === 'active') {
        setPairingId(pairing.id);
        setPairingStatus('active');
      } else {
        setPairingStatus('pending');
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const msg = getErrorMessage(err, 'message.getPairingFail');
      setPairingLoadError(msg);
      setPairingStatus('pending');
    }
  }, [mountedRef]);

  useEffect(() => { checkPairing(); }, [checkPairing]);

  // --- Psych Profile Check (pre-case banner) ---
  useEffect(() => {
    let cancelled = false;
    psychProfileApi.getProfile()
      .then((profile) => {
        if (cancelled) return;
        if (!profile) return;
        setProfileConsent(!!profile.consent_given);
        if ((profile.richness_score ?? 0) < PRE_CASE_RICHNESS_THRESHOLD) {
          setShowPreCaseBanner(true);
        }
      })
      .catch((e: unknown) => { logger.warn('Failed to fetch profile for pre-case banner', e); });
    return () => { cancelled = true; };
  }, [setProfileConsent]);

  // --- Validation ---
  const plaintiffValid = validateStatement(plaintiffStatement).valid;
  const defendantValid = validateStatement(defendantStatement).valid;
  const isRemote = mode === 'remote';

  // Step configuration based on mode
  const totalSteps = isRemote ? 3 : 4;
  // Remote: 0=Mode+Title, 1=Plaintiff, 2=Evidence+Submit
  // Collaborative: 0=Mode+Title, 1=Plaintiff, 2=Defendant, 3=Evidence+Submit

  const canProceedFromStep = (step: number): boolean => {
    if (step === 0) return true; // mode + title are optional/always valid
    if (step === 1) return plaintiffValid;
    if (step === 2 && !isRemote) return defendantValid;
    return true;
  };

  // --- Submit ---
  const handleSubmit = async () => {
    if (submitting || submitLockRef.current) return;
    if (!pairingId) {
      toast.error(t('message.pairingRequired'));
      navigate('/profile/pairing');
      return;
    }

    const canSubmit = isRemote ? plaintiffValid : plaintiffValid && defendantValid;
    if (!canSubmit) {
      toast.warning(isRemote ? t('caseCreate.plaintiffStatementRequired') : t('message.completeBothStatements'));
      return;
    }

    submitLockRef.current = true;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const caseData: Parameters<typeof createCase>[0] = {
        pairing_id: pairingId,
        title: title || undefined,
        plaintiff_statement: plaintiffStatement,
        mode,
        evidence_urls: [],
      };
      if (!isRemote && defendantStatement) {
        caseData.defendant_statement = defendantStatement;
      }

      const newCase = await createCase(caseData);
      if (!mountedRef.current) return;
      celebrate();
      toast.success(isRemote ? t('caseCreate.remoteCreateSuccess') : t('message.createCaseSuccess'));

      const filesToUpload: File[] = evidenceFiles
        .filter((f): f is UploadFile<File> & { originFileObj: File } => Boolean(f.originFileObj))
        .map((f) => f.originFileObj);

      if (filesToUpload.length > 0) {
        try {
          const { uploadEvidence } = await import('@/services/api/case');
          await uploadEvidence(newCase.id, filesToUpload);
          if (mountedRef.current) toast.success(t('message.evidenceUploadSuccess'));
        } catch (uploadError: unknown) {
          if (mountedRef.current) {
            toast.warning(getErrorMessage(uploadError, 'message.evidenceUploadFailCaseCreated'));
          }
        }
      }

      if (!mountedRef.current) return;
      navigate(`/case/${newCase.id}`);
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      const errorMessage = getErrorMessage(error, 'message.createCaseFail');
      toast.error(errorMessage);
      setSubmitError(errorMessage);
    } finally {
      submitLockRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!canProceedFromStep(currentStep)) {
      if (currentStep === 1) toast.warning(t('caseCreate.plaintiffStatementRequired'));
      if (currentStep === 2 && !isRemote) toast.warning(t('message.completeBothStatements'));
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  // --- Loading State ---
  if (pairingStatus === 'loading') {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  // --- Pairing Required Gate ---
  if (pairingStatus === 'pending') {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          {pairingLoadError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-5 text-destructive shrink-0" />
                <p className="text-sm text-foreground">{pairingLoadError}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={checkPairing} data-testid="case-create-pairing-retry">
                  {t('common.retry')}
                </Button>
                <Button size="sm" onClick={() => navigate('/profile/pairing')}>
                  {t('caseCreate.goPairing')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-warning/30 bg-warning/5 p-6 space-y-4">
              <h3 className="font-semibold text-foreground">{t('caseCreate.pairingRequired')}</h3>
              <p className="text-sm text-muted-foreground">{t('caseCreate.pairingDesc')}</p>
              <Button onClick={() => navigate('/profile/pairing')}>
                {t('caseCreate.goPairing')}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Main Wizard ---
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <>
      <SEO title={t('caseCreate.title')} description={t('caseCreate.description')} keywords={t('caseCreate.keywords')} />

      <div className="flex min-h-screen flex-col bg-background" role="main" aria-label={t('caseCreate.pageLabel')}>
        {/* Fixed Header */}
        <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between bg-background/90 px-6 py-4 backdrop-blur-xl border-b border-border/50">
          <button
            onClick={() => currentStep > 0 ? handlePrev() : navigate('/case/list')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={currentStep > 0 ? t('quickCreate.step.prev') : t('common.back')}
          >
            <ArrowLeft className="size-5" />
          </button>
          <Progress value={((currentStep + 1) / totalSteps) * 100} className="w-[180px] h-1.5" />
          <span className="text-xs text-muted-foreground">{currentStep + 1}/{totalSteps}</span>
        </header>

        {/* Pre-Case Interview Banner */}
        {showPreCaseBanner && currentStep === 0 && (
          <div className="mx-auto mt-20 w-full max-w-2xl px-6">
            <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary-light/50 p-4">
              <Heart className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{t('trigger.preCaseTitle')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('trigger.preCaseDesc')}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={handlePreCaseChat}>{t('trigger.preCaseOk')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowPreCaseBanner(false)}>{t('trigger.preCaseSkip')}</Button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPreCaseBanner(false)}
                aria-label={t('common.dismiss')}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="flex flex-1 items-center justify-center px-6 pt-24 pb-10">
          <AnimatePresence mode="wait">
            {/* Step 0: Mode + Title */}
            {currentStep === 0 && (
              <motion.div
                key="step-mode"
                variants={stepVariants}
                initial="initial" animate="animate" exit="exit"
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-[640px] space-y-8"
              >
                <div className="text-center">
                  <MediatorAvatar size="medium" animated />
                  <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground font-heading">
                    {t('caseCreate.heading')}
                  </h2>
                  <p className="mt-2 text-base text-muted-foreground">{t('caseCreate.subtitle')}</p>
                </div>

                {/* Title Input */}
                <div className="space-y-2">
                  <label htmlFor="case-create-title" className="text-sm font-medium text-foreground">{t('caseCreate.caseTitle')}</label>
                  <Input
                    id="case-create-title"
                    autoComplete="off"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('caseCreate.caseTitlePlaceholder')}
                    maxLength={200}
                    className="h-12 rounded-xl"
                  />
                  <div className="flex items-start gap-2 rounded-lg bg-primary-light/30 p-3">
                    <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                    <p className="text-xs text-muted-foreground">{t('caseCreate.aiAutoDetectHint')}</p>
                  </div>
                </div>

                {/* Mode Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">{t('caseCreate.mode')}</label>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setMode('remote')}
                      className={cn(
                        'w-full rounded-xl border-2 p-4 text-left transition-all',
                        mode === 'remote'
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/30',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'h-4 w-4 rounded-full border-2 transition-colors',
                          mode === 'remote' ? 'border-primary bg-primary' : 'border-muted-foreground',
                        )}>
                          {mode === 'remote' && <div className="h-full w-full rounded-full bg-white scale-[0.4]" />}
                        </div>
                        <span className="font-medium text-foreground">{t('caseCreate.modeRemoteLabel')}</span>
                      </div>
                      <p className="mt-1 ml-7 text-xs text-muted-foreground">{t('caseCreate.modeRemoteDesc')}</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('collaborative')}
                      className={cn(
                        'w-full rounded-xl border-2 p-4 text-left transition-all',
                        mode === 'collaborative'
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/30',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'h-4 w-4 rounded-full border-2 transition-colors',
                          mode === 'collaborative' ? 'border-primary bg-primary' : 'border-muted-foreground',
                        )}>
                          {mode === 'collaborative' && <div className="h-full w-full rounded-full bg-white scale-[0.4]" />}
                        </div>
                        <span className="font-medium text-foreground">{t('caseCreate.modeCollaborativeLabel')}</span>
                      </div>
                      <p className="mt-1 ml-7 text-xs text-muted-foreground">{t('caseCreate.modeCollaborativeDesc')}</p>
                    </button>
                  </div>
                </div>

                {/* Next */}
                <div className="flex justify-end">
                  <Button size="lg" onClick={handleNext} className="h-12 rounded-full px-10 font-semibold shadow-md">
                    {t('quickCreate.step.next')}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 1: Plaintiff Statement */}
            {currentStep === 1 && (
              <motion.div
                key="step-plaintiff"
                variants={stepVariants}
                initial="initial" animate="animate" exit="exit"
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-[720px] space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground font-heading">
                    {isRemote ? t('caseCreate.plaintiffStatementTitle') : t('caseDetail.plaintiffStatement')}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{t('caseCreate.plaintiffPlaceholder')}</p>
                </div>

                <StatementInput
                  value={plaintiffStatement}
                  onChange={(value: string) => {
                    if (submitError) setSubmitError(null);
                    setPlaintiffStatement(value);
                  }}
                  placeholder={t('caseCreate.plaintiffPlaceholder')}
                />

                {isRemote && (
                  <div className="flex items-start gap-2 rounded-lg bg-primary-light/30 p-3">
                    <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                    <p className="text-xs text-muted-foreground">{t('caseCreate.remoteFlowHint')}</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Button variant="outline" size="lg" onClick={handlePrev} className="h-12 rounded-full px-8 font-semibold">
                    {t('quickCreate.step.prev')}
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleNext}
                    disabled={!plaintiffValid}
                    className="h-12 rounded-full px-10 font-semibold shadow-md"
                  >
                    {t('quickCreate.step.next')}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 2 (Collaborative only): Defendant Statement */}
            {currentStep === 2 && !isRemote && (
              <motion.div
                key="step-defendant"
                variants={stepVariants}
                initial="initial" animate="animate" exit="exit"
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-[720px] space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground font-heading">
                    {t('caseDetail.defendantStatement')}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{t('caseCreate.defendantPlaceholder')}</p>
                </div>

                <StatementInput
                  value={defendantStatement}
                  onChange={(value: string) => {
                    if (submitError) setSubmitError(null);
                    setDefendantStatement(value);
                  }}
                  placeholder={t('caseCreate.defendantPlaceholder')}
                />

                <div className="flex items-center justify-between">
                  <Button variant="outline" size="lg" onClick={handlePrev} className="h-12 rounded-full px-8 font-semibold">
                    {t('quickCreate.step.prev')}
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleNext}
                    disabled={!defendantValid}
                    className="h-12 rounded-full px-10 font-semibold shadow-md"
                  >
                    {t('quickCreate.step.next')}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Last Step: Evidence + Submit */}
            {isLastStep && currentStep === totalSteps - 1 && (
              <motion.div
                key="step-evidence-submit"
                variants={stepVariants}
                initial="initial" animate="animate" exit="exit"
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-[720px] space-y-8"
              >
                {/* Evidence */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground font-heading">
                      {t('caseCreate.evidenceTitle')}
                    </h2>
                    <span className="text-xs text-muted-foreground">{t('caseCreate.evidenceExtra')}</span>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <FileUpload value={evidenceFiles} onChange={setEvidenceFiles} maxCount={3} />
                  </div>
                </div>

                {/* Submit Error */}
                {submitError && (
                  <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                    <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{submitError}</p>
                      <button onClick={handleSubmit} className="mt-1 text-xs font-medium text-primary hover:underline">
                        {t('common.retry')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-3">
                  <Button
                    size="lg"
                    onClick={handleSubmit}
                    disabled={submitting || !(isRemote ? plaintiffValid : plaintiffValid && defendantValid)}
                    className="h-14 w-full rounded-2xl text-base font-semibold shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        {t('caseCreate.creating')}
                      </span>
                    ) : t('caseCreate.submitBtn')}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">{t('caseCreate.submitHint')}</p>

                  <Button variant="outline" onClick={handlePrev} className="h-12 w-full rounded-full font-semibold">
                    {t('quickCreate.step.prev')}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ConsentModal
          open={consentOpen}
          onConsent={handleConsent}
          onCancel={() => setConsentOpen(false)}
          loading={consentLoading}
        />
        <CelebrationOverlay show={celebrating} onComplete={onCelebrationComplete} />
      </div>
    </>
  );
};

export default CaseCreate;
