/**
 * 協作聽證模式 — 同設備雙人輪流陳述
 *
 * 遷移: Ant Design Typography/Button/Steps/Input/Card/Alert/message → shadcn/ui + Tailwind + sonner
 * 保留: 所有業務邏輯（createCollaborativeCase, session, phase 狀態機）
 * 保留: Framer Motion 動畫（相位轉場、emoji 動畫）
 */

import { useState, useCallback, useRef } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Pencil, ArrowLeftRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createCollaborativeCase } from '@/services/api/case';
import { sessionStorage, caseSessionMap } from '@/utils/storage';
import SEO from '@/components/common/SEO';
import MediatorAvatar from '@/components/business/MediatorAvatar';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import { MIN_STATEMENT_LENGTH, MIN_DEFENDANT_LENGTH } from '@/utils/constants';

type Phase = 'intro' | 'role_a' | 'handoff' | 'role_b' | 'submitting';

const STEP_CONFIG = [
  { color: 'bg-orange-500', icon: Pencil },
  { color: 'bg-amber-400', icon: ArrowLeftRight },
  { color: 'bg-sky-500', icon: Pencil },
  { color: 'bg-emerald-400', icon: CheckCircle },
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
      <div className="min-h-screen bg-gradient-to-b from-[#1a1210] to-[#2C2420] px-4 py-10 md:py-16">
        <div className="mx-auto w-full max-w-[640px]">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 text-center"
          >
            <MediatorAvatar size="medium" animated />
            <h2 className="mt-4 text-2xl font-bold text-white font-heading md:text-3xl">
              {t('collaborative.title')}
            </h2>
            <p className="mt-2 text-base text-white/60">
              {t('collaborative.subtitle')}
            </p>
          </motion.div>

          {/* Step Indicator */}
          <div className="mb-8 flex items-center justify-center gap-2">
            {STEP_CONFIG.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep >= index;
              return (
                <div key={index} className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                    isActive ? step.color : 'bg-white/10'
                  }`}>
                    <Icon className={`size-4 ${isActive ? 'text-white' : 'text-white/40'}`} />
                  </div>
                  {index < 3 && (
                    <div className={`h-0.5 w-6 rounded-full transition-colors ${
                      currentStep > index ? 'bg-white/40' : 'bg-white/10'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Phase Content */}
          <AnimatePresence mode="wait">
            {phase === 'intro' && (
              <motion.div key="intro" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm md:p-8">
                  <p className="mb-4 text-base leading-relaxed text-white/80">{t('collaborative.introText')}</p>
                  <ul className="mb-6 space-y-2 text-sm text-white/70">
                    <li><span className="mr-1 font-semibold text-orange-400">{t('collaborative.roleALabel')}</span>{t('collaborative.introRule1')}</li>
                    <li>{t('collaborative.introRule2Prefix')}<span className="font-semibold text-sky-400">{t('collaborative.roleBLabel')}</span></li>
                    <li><span className="mr-1 font-semibold text-sky-400">{t('collaborative.roleBLabel')}</span>{t('collaborative.introRule3Suffix')}</li>
                    <li>{t('collaborative.introRule4')}</li>
                  </ul>
                  <p className="mb-6 text-sm italic text-amber-300/80">{t('collaborative.introTip')}</p>
                  <Button
                    onClick={() => setPhase('role_a')}
                    className="h-12 w-full rounded-2xl bg-orange-500 text-base font-semibold text-white hover:bg-orange-600"
                  >
                    {t('collaborative.startBtn')}
                  </Button>
                </div>
              </motion.div>
            )}

            {phase === 'role_a' && (
              <motion.div key="role_a" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}>
                <div className="rounded-3xl border border-orange-500/20 bg-white/5 p-6 backdrop-blur-sm md:p-8">
                  <h4 className="mb-2 text-lg font-bold text-orange-400">{t('collaborative.roleATitle')}</h4>
                  <p className="mb-4 text-sm text-white/60">{t('collaborative.roleAHint')}</p>

                  {submitError && (
                    <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <div className="flex-1">
                        <p className="text-sm text-white/80">{submitError}</p>
                        <button onClick={() => void handleRoleASubmit()} className="mt-1 text-xs font-medium text-primary hover:underline">
                          {t('error.retry')}
                        </button>
                      </div>
                    </div>
                  )}

                  <textarea
                    value={roleAText}
                    onChange={(e) => { if (submitError) setSubmitError(null); setRoleAText(e.target.value); }}
                    placeholder={t('collaborative.placeholder')}
                    maxLength={2000}
                    rows={10}
                    className="w-full resize-none rounded-2xl border border-orange-500/20 bg-white/5 p-4 text-base text-white placeholder:text-white/30 focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                  <div className="mt-1 text-right text-xs text-white/40">{roleAText.length}/2000</div>

                  <div className="mt-6 flex items-center justify-between">
                    <button onClick={() => setPhase('intro')} className="text-sm font-medium text-white/50 hover:text-white/80 transition-colors">
                      {t('collaborative.back')}
                    </button>
                    <Button
                      onClick={handleRoleASubmit}
                      disabled={roleAText.trim().length < MIN_STATEMENT_LENGTH || isSubmitting}
                      className="h-11 rounded-2xl bg-orange-500 px-8 font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                    >
                      {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                      {t('collaborative.roleASubmit')}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {phase === 'handoff' && (
              <motion.div key="handoff" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.3 }}>
                <div className="rounded-3xl border border-amber-400/20 bg-white/5 p-8 text-center backdrop-blur-sm md:p-10">
                  <motion.div
                    animate={{ rotate: [0, 15, -15, 0] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                    className="mb-6 text-6xl"
                  >
                    📱
                  </motion.div>
                  <h3 className="mb-3 text-xl font-bold text-amber-300">{t('collaborative.handoffTitle')}</h3>
                  <p className="mb-2 text-base text-white/70">{t('collaborative.handoffRecorded')}</p>
                  <p className="mb-1 text-base text-white/70">{t('collaborative.handoffPassDevice')}</p>
                  <p className="mb-8 text-sm text-white/40">{t('collaborative.handoffNote')}</p>
                  <Button
                    onClick={() => setPhase('role_b')}
                    className="h-12 w-full rounded-2xl bg-sky-500 text-base font-semibold text-white hover:bg-sky-600"
                  >
                    {t('collaborative.roleBStart')}
                  </Button>
                </div>
              </motion.div>
            )}

            {phase === 'role_b' && (
              <motion.div key="role_b" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}>
                <div className="rounded-3xl border border-sky-500/20 bg-white/5 p-6 backdrop-blur-sm md:p-8">
                  <h4 className="mb-2 text-lg font-bold text-sky-400">{t('collaborative.roleBTitle')}</h4>
                  <p className="mb-4 text-sm text-white/60">{t('collaborative.roleBHint')}</p>

                  {submitError && (
                    <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <div className="flex-1">
                        <p className="text-sm text-white/80">{submitError}</p>
                        <button onClick={() => void handleRoleBSubmit()} className="mt-1 text-xs font-medium text-primary hover:underline">
                          {t('error.retry')}
                        </button>
                      </div>
                    </div>
                  )}

                  <textarea
                    value={roleBText}
                    onChange={(e) => { if (submitError) setSubmitError(null); setRoleBText(e.target.value); }}
                    placeholder={t('collaborative.placeholder')}
                    maxLength={2000}
                    rows={10}
                    className="w-full resize-none rounded-2xl border border-sky-500/20 bg-white/5 p-4 text-base text-white placeholder:text-white/30 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                  <div className="mt-1 text-right text-xs text-white/40">{roleBText.length}/2000</div>

                  <div className="mt-6 flex items-center justify-between">
                    <button
                      onClick={() => setPhase('handoff')}
                      disabled={isSubmitting}
                      className="text-sm font-medium text-white/50 hover:text-white/80 transition-colors disabled:opacity-30"
                    >
                      {t('collaborative.back')}
                    </button>
                    <Button
                      onClick={handleRoleBSubmit}
                      disabled={roleBText.trim().length < MIN_DEFENDANT_LENGTH || isSubmitting}
                      className="h-11 rounded-2xl bg-emerald-500 px-8 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                    >
                      {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                      {t('collaborative.submitBtn')}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {phase === 'submitting' && (
              <motion.div key="submitting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
                    className="mb-6 text-5xl"
                  >
                    🤖
                  </motion.div>
                  <p className="text-base text-white/60">{t('collaborative.submittingText')}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};

export default CollaborativeCreate;
