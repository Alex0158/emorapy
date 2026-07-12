/**
 * 協作聽證模式 — 同設備雙人輪流陳述
 *
 * 遷移: legacy typography/button/steps/input/card/alert/message controls → shadcn/ui + Tailwind + sonner
 * 保留: 所有業務邏輯（createCollaborativeCase, session, phase 狀態機）
 * 交接後立即從前端狀態清除角色 A 的原文，避免同機回看。
 */

import { useState, useCallback, useRef } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Pencil, ArrowLeftRight, CheckCircle, AlertCircle, Loader2, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createCollaborativeCase } from '@/services/api/case';
import { sessionStorage, caseSessionMap } from '@/utils/storage';
import SEO from '@/components/common/SEO';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import { MIN_STATEMENT_LENGTH, MIN_DEFENDANT_LENGTH } from '@/utils/constants';

type Phase = 'intro' | 'role_a' | 'handoff' | 'role_b' | 'submitting';

const STEP_CONFIG = [
  { labelKey: 'collaborative.stepRoleA', icon: Pencil },
  { labelKey: 'collaborative.stepHandoff', icon: ArrowLeftRight },
  { labelKey: 'collaborative.stepRoleB', icon: Pencil },
  { labelKey: 'collaborative.stepSubmit', icon: CheckCircle },
] as const;

const CollaborativeCreate = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('intro');
  const [roleAText, setRoleAText] = useState('');
  const [roleBText, setRoleBText] = useState('');
  const [caseId, setCaseId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mountedRef = useMountedRef();
  const submitLockRef = useRef(false);

  const currentStep = phase === 'intro' || phase === 'role_a' ? 0
    : phase === 'handoff' ? 1
    : phase === 'role_b' ? 2 : 3;

  const handleRoleASubmit = useCallback(async () => {
    if (roleAText.trim().length < MIN_STATEMENT_LENGTH) {
      toast.warning(t('collaborative.minLengthWarning').replace('{count}', String(MIN_STATEMENT_LENGTH)));
      return;
    }
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const result = await createCollaborativeCase(
        { plaintiff_statement: roleAText.trim() },
        sessionId ?? undefined,
      );
      if (!mountedRef.current) return;
      setCaseId(result.case.id);
      setSessionId(result.session_id);
      sessionStorage.set(result.session_id);
      setRoleAText('');
      setPhase('handoff');
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      const errorMessage = getErrorMessage(error, 'message.submitFail');
      toast.error(errorMessage);
      setSubmitError(errorMessage);
    } finally {
      submitLockRef.current = false;
      if (mountedRef.current) setIsSubmitting(false);
    }
  }, [roleAText, sessionId, mountedRef]);

  const handleRoleBSubmit = useCallback(async () => {
    if (roleBText.trim().length < MIN_DEFENDANT_LENGTH) {
      toast.warning(t('collaborative.minLengthWarning').replace('{count}', String(MIN_DEFENDANT_LENGTH)));
      return;
    }
    if (!caseId || !sessionId) {
      toast.error(t('collaborative.caseMissing'));
      return;
    }
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitError(null);
    setIsSubmitting(true);
    setPhase('submitting');
    try {
      const result = await createCollaborativeCase(
        { case_id: caseId, defendant_statement: roleBText.trim() },
        sessionId,
      );
      if (!mountedRef.current) return;
      caseSessionMap.set(result.case.id, result.session_id);
      toast.success(t('collaborative.submitSuccess'));
      navigate(`/quick-experience/result/${result.case.id}`);
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      const errorMessage = getErrorMessage(error, 'message.submitFail');
      toast.error(errorMessage);
      setSubmitError(errorMessage);
      setPhase('role_b');
    } finally {
      submitLockRef.current = false;
      if (mountedRef.current) setIsSubmitting(false);
    }
  }, [roleBText, caseId, sessionId, navigate, mountedRef]);

  return (
    <>
      <SEO title={t('collaborative.seoTitle')} description={t('collaborative.seoDesc')} />
      <div className="min-h-[calc(100vh-4rem)] bg-background px-5 py-8 md:py-12">
        <div className="mx-auto w-full max-w-5xl">
          <div className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t('collaborative.seoTitle')}</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] md:text-5xl">{t('collaborative.title')}</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{t('collaborative.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/quick-experience/create', { replace: true })}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
              {t('collaborative.exitToSolo')}
            </button>
          </div>

          <ol className="grid grid-cols-2 border-b border-border md:grid-cols-4" aria-label={t('collaborative.title')}>
            {STEP_CONFIG.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep >= index;
              return (
                <li key={step.labelKey} className={`flex min-h-16 items-center gap-3 border-r border-border px-3 text-xs last:border-r-0 md:px-4 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  <Icon className={`size-4 ${isActive ? 'text-primary' : ''}`} aria-hidden="true" />
                  <span>{t(step.labelKey)}</span>
                </li>
              );
            })}
          </ol>

          <div className="mx-auto max-w-2xl py-10 md:py-16">
          {phase === 'intro' && (
              <section aria-labelledby="collaborative-intro-title">
                <h2 id="collaborative-intro-title" className="text-3xl font-semibold tracking-[-0.02em]">{t('collaborative.introText')}</h2>
                  <ul className="mt-7 space-y-4 border-l border-border pl-5 text-sm leading-6 text-muted-foreground">
                    <li><span className="mr-1 font-semibold text-foreground">{t('collaborative.roleALabel')}</span>{t('collaborative.introRule1')}</li>
                    <li>{t('collaborative.introRule2Prefix')}<span className="font-semibold text-foreground">{t('collaborative.roleBLabel')}</span></li>
                    <li><span className="mr-1 font-semibold text-foreground">{t('collaborative.roleBLabel')}</span>{t('collaborative.introRule3Suffix')}</li>
                    <li>{t('collaborative.introRule4')}</li>
                  </ul>
                  <div className="mt-7 flex items-start gap-3 border border-border p-4 text-sm leading-6 text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
                    <p>{t('collaborative.privacyWarning')}</p>
                  </div>
                  <Button
                    onClick={() => setPhase('role_a')}
                    className="mt-7 w-full text-base"
                  >
                    {t('collaborative.startBtn')}
                  </Button>
              </section>
            )}

            {phase === 'role_a' && (
              <section aria-labelledby="role-a-title">
                  <h2 id="role-a-title" className="text-3xl font-semibold tracking-[-0.02em]">{t('collaborative.roleATitle')}</h2>
                  <p className="mb-6 mt-3 text-sm leading-6 text-muted-foreground">{t('collaborative.roleAHint')}</p>

                  {submitError && (
                    <div className="mb-4 flex items-start gap-3 border border-destructive/30 p-3">
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{submitError}</p>
                        <button onClick={() => void handleRoleASubmit()} className="mt-1 text-xs font-medium text-primary hover:underline">
                          {t('error.retry')}
                        </button>
                      </div>
                    </div>
                  )}

                  <textarea
                    aria-label={t('collaborative.roleATitle')}
                    autoComplete="off"
                    value={roleAText}
                    onChange={(e) => { if (submitError) setSubmitError(null); setRoleAText(e.target.value); }}
                    placeholder={t('collaborative.placeholder')}
                    maxLength={2000}
                    rows={10}
                    className="w-full resize-none rounded-md border border-input bg-surface p-4 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  />
                  <div className="mt-1 text-right text-xs text-muted-foreground">{roleAText.length}/2000</div>

                  <div className="mt-6 flex items-center justify-between">
                    <button onClick={() => setPhase('intro')} className="min-h-11 text-sm font-medium text-muted-foreground hover:text-foreground">
                      {t('collaborative.back')}
                    </button>
                    <Button
                      onClick={handleRoleASubmit}
                      disabled={roleAText.trim().length < MIN_STATEMENT_LENGTH || isSubmitting}
                      className="px-8"
                    >
                      {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                      {t('collaborative.roleASubmit')}
                    </Button>
                  </div>
              </section>
            )}

            {phase === 'handoff' && (
              <section className="text-center" aria-labelledby="handoff-title">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-md border border-border text-primary">
                    <ArrowLeftRight className="size-5" aria-hidden="true" />
                  </div>
                  <h2 id="handoff-title" className="mt-6 text-3xl font-semibold tracking-[-0.02em]">{t('collaborative.handoffTitle')}</h2>
                  <p className="mt-5 text-base text-foreground">{t('collaborative.handoffRecorded')}</p>
                  <p className="mt-2 text-base text-muted-foreground">{t('collaborative.handoffPassDevice')}</p>
                  <p className="mx-auto mt-5 max-w-md border-y border-border py-4 text-sm leading-6 text-muted-foreground">{t('collaborative.handoffNote')}</p>
                  <Button
                    onClick={() => setPhase('role_b')}
                    className="mt-8 w-full text-base"
                  >
                    {t('collaborative.roleBStart')}
                  </Button>
              </section>
            )}

            {phase === 'role_b' && (
              <section aria-labelledby="role-b-title">
                  <h2 id="role-b-title" className="text-3xl font-semibold tracking-[-0.02em]">{t('collaborative.roleBTitle')}</h2>
                  <p className="mb-6 mt-3 text-sm leading-6 text-muted-foreground">{t('collaborative.roleBHint')}</p>

                  {submitError && (
                    <div className="mb-4 flex items-start gap-3 border border-destructive/30 p-3">
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{submitError}</p>
                        <button onClick={() => void handleRoleBSubmit()} className="mt-1 text-xs font-medium text-primary hover:underline">
                          {t('error.retry')}
                        </button>
                      </div>
                    </div>
                  )}

                  <textarea
                    aria-label={t('collaborative.roleBTitle')}
                    autoComplete="off"
                    value={roleBText}
                    onChange={(e) => { if (submitError) setSubmitError(null); setRoleBText(e.target.value); }}
                    placeholder={t('collaborative.placeholder')}
                    maxLength={2000}
                    rows={10}
                    className="w-full resize-none rounded-md border border-input bg-surface p-4 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  />
                  <div className="mt-1 text-right text-xs text-muted-foreground">{roleBText.length}/2000</div>

                  <div className="mt-6 flex items-center justify-between">
                    <button
                      onClick={() => setPhase('handoff')}
                      disabled={isSubmitting}
                      className="min-h-11 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      {t('collaborative.back')}
                    </button>
                    <Button
                      onClick={handleRoleBSubmit}
                      disabled={roleBText.trim().length < MIN_DEFENDANT_LENGTH || isSubmitting}
                      className="px-8"
                    >
                      {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                      {t('collaborative.submitBtn')}
                    </Button>
                  </div>
              </section>
            )}

            {phase === 'submitting' && (
              <section className="flex flex-col items-center justify-center py-16 text-center" aria-live="polite">
                <Loader2 className="mb-6 size-8 animate-spin text-primary" aria-hidden="true" />
                <h2 className="text-2xl font-semibold">{t('collaborative.stepSubmit')}</h2>
                <p className="mt-3 text-base text-muted-foreground">{t('collaborative.submittingText')}</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CollaborativeCreate;
