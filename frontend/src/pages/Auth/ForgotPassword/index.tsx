/**
 * 忘記密碼頁面
 *
 * 遷移: legacy form controls → shadcn/ui + 原生表單
 * 保留: 3 步驟流程（郵箱→驗證碼→新密碼）、所有業務邏輯
 */

import { Eye, EyeOff, Mail, Lock, CheckCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SEO from '@/components/common/SEO';
import FormFeedback from '@/components/common/FormFeedback';
import { confirmResetPassword, resetPassword } from '@/services/api/auth';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';

const CODE_LENGTH = 6;

const stepVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const ForgotPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useMountedRef();
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const sendResetLockRef = useRef(false);
  const resetLockRef = useRef(false);

  const VALID_REDIRECT_PREFIXES = [
    '/case', '/judgment', '/reconciliation', '/execution',
    '/profile', '/interview', '/quick-experience', '/chat',
  ];
  const state = location.state as { from?: { pathname?: string } } | null;
  const rawFrom = state?.from?.pathname || '/case/list';
  const isValidRedirect = rawFrom === '/' || VALID_REDIRECT_PREFIXES.some((prefix) => rawFrom.startsWith(prefix));
  const from = isValidRedirect ? rawFrom : '/case/list';

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const startCountdown = useCallback(() => {
    setCountdown(300);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSendResetEmail = async (e?: FormEvent) => {
    e?.preventDefault();
    setFormError(null);
    if (!email) { setErrors({ email: t('auth.login.emailRequired') }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErrors({ email: t('auth.login.emailInvalid') }); return; }
    if (sendResetLockRef.current) return;
    sendResetLockRef.current = true;
    setLoading(true);
    try {
      await resetPassword(email);
      if (!mountedRef.current) return;
      startCountdown();
      toast.success(t('message.resetEmailSent'));
      setCurrentStep(1);
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      setFormError(getErrorMessage(error, 'message.sendResetFail'));
    } finally {
      sendResetLockRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleResendCode = () => {
    if (countdown > 0) { toast.warning(t('message.waitCountdown').replace('{count}', String(countdown))); return; }
    handleSendResetEmail();
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
    setFormError(null);
    if (value && index < CODE_LENGTH - 1) codeInputRefs.current[index + 1]?.focus();
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    const newCode = Array(CODE_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) newCode[i] = pasted[i];
    setVerificationCode(newCode);
    codeInputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const newErrors: Record<string, string> = {};
    if (!password) newErrors.password = t('auth.forgot.newPasswordRequired');
    else if (password.length < 8) newErrors.password = t('auth.register.passwordMin');
    else if (!/^(?=.*[A-Za-z])(?=.*\d)/.test(password)) newErrors.password = t('auth.register.passwordPattern');
    if (!confirmPassword) newErrors.confirmPassword = t('auth.forgot.confirmNewRequired');
    else if (password !== confirmPassword) newErrors.confirmPassword = t('message.passwordMismatch');
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    const code = verificationCode.join('');
    if (code.length !== CODE_LENGTH) { setFormError(t('message.codeFull')); return; }
    if (resetLockRef.current) return;
    resetLockRef.current = true;
    setLoading(true);
    try {
      await confirmResetPassword(email, code, password);
      if (!mountedRef.current) return;
      toast.success(t('message.resetSuccess'));
      setResetDone(true);
      redirectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) navigate('/auth/login', { state: { from: { pathname: from } } });
      }, 2000);
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      setFormError(getErrorMessage(error, 'message.resetFail'));
    } finally {
      resetLockRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <SEO title={t('auth.forgot.title')} description={t('auth.forgot.description')} keywords={t('auth.forgot.keywords')} />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="w-full"
        role="region"
        aria-label={t('auth.forgot.pageLabel')}
      >
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold tracking-tight text-foreground font-heading">
            {t('auth.forgot.heading')}
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            {t('auth.forgot.subtitle')}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8 flex items-center gap-2" aria-label={t('auth.forgot.stepsLabel')}>
          {[0, 1, 2].map((step) => (
            <div key={step} className="flex items-center gap-2 flex-1">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                step <= currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {step + 1}
              </div>
              {step < 2 && (
                <div className={`h-0.5 flex-1 rounded-full transition-colors ${
                  step < currentStep ? 'bg-primary' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>

        {formError && (
          <div className="mb-5">
            <FormFeedback id="forgot-password-form-error" message={formError} />
          </div>
        )}

        <AnimatePresence mode="wait">
          {currentStep === 0 && (
            <motion.form
              key="step-email"
              variants={stepVariants}
              initial="initial" animate="animate" exit="exit"
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onSubmit={handleSendResetEmail}
              className="space-y-5"
              noValidate
            >
              <div className="space-y-2">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="email"
                    aria-label={t('auth.register.email')}
                    placeholder={t('auth.forgot.emailPlaceholder')}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors({});
                      setFormError(null);
                    }}
                    className="h-12 rounded-md border-input bg-transparent pl-11 text-base focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </div>
                {errors.email && <p className="text-sm text-destructive pl-1">{errors.email}</p>}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="mt-2 h-12 w-full rounded-md text-base"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {t('common.loading')}
                  </span>
                ) : t('auth.forgot.sendResetEmail')}
              </Button>
            </motion.form>
          )}

          {currentStep === 1 && (
            <motion.div
              key="step-verify"
              variants={stepVariants}
              initial="initial" animate="animate" exit="exit"
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{t('auth.register.codeSentTo')}</p>
                <p className="mt-1 text-base font-semibold text-foreground">{email}</p>
              </div>

              <div className="flex justify-between gap-2">
                {verificationCode.map((value, index) => (
                  <input
                    key={index}
                    ref={(el) => { codeInputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={1}
                    value={value}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(index, e)}
                    onPaste={handleCodePaste}
                    className="h-14 w-12 rounded-md border border-input bg-transparent text-center text-xl font-bold text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                    aria-label={`${t('auth.forgot.stepVerify')} ${index + 1}`}
                    autoComplete="one-time-code"
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {t('auth.register.codeExpiry')} {formatCountdown(countdown)}
                </p>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={countdown > 0}
                  className="mt-2 min-h-11 px-2 text-sm font-medium text-primary transition-colors hover:text-primary-hover disabled:cursor-not-allowed disabled:text-muted-foreground"
                >
                  {t('auth.register.resendCode')}
                </button>
              </div>

              <Button
                onClick={() => setCurrentStep(2)}
                disabled={verificationCode.join('').length !== CODE_LENGTH}
                className="h-12 w-full rounded-md text-base"
              >
                {t('auth.register.verifyAndContinue')}
              </Button>
            </motion.div>
          )}

          {currentStep === 2 && !resetDone && (
            <motion.form
              key="step-password"
              variants={stepVariants}
              initial="initial" animate="animate" exit="exit"
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onSubmit={handleResetPassword}
              className="space-y-5"
              noValidate
            >
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    aria-label={t('auth.forgot.newPassword')}
                    placeholder={t('auth.forgot.newPasswordPlaceholder')}
                    maxLength={128}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors((prev) => { const { password: _, ...rest } = prev; return rest; });
                      setFormError(null);
                    }}
                    className="h-12 rounded-md border-input bg-transparent pl-11 pr-11 text-base focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive pl-1">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    aria-label={t('auth.forgot.confirmNewPassword')}
                    placeholder={t('auth.forgot.confirmNewPlaceholder')}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setErrors((prev) => { const { confirmPassword: _, ...rest } = prev; return rest; });
                      setFormError(null);
                    }}
                    className="h-12 rounded-md border-input bg-transparent pl-11 text-base focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </div>
                {errors.confirmPassword && <p className="text-sm text-destructive pl-1">{errors.confirmPassword}</p>}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="mt-2 h-12 w-full rounded-md text-base"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {t('common.loading')}
                  </span>
                ) : t('auth.forgot.resetButton')}
              </Button>
            </motion.form>
          )}

          {resetDone && (
            <motion.div
              key="step-done"
              variants={stepVariants}
              initial="initial" animate="animate" exit="exit"
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="py-8 text-center space-y-4"
            >
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle className="size-8 text-success" />
                </div>
              </div>
              <h4 className="text-xl font-semibold text-foreground">{t('auth.forgot.successTitle')}</h4>
              <p className="text-sm text-muted-foreground">{t('auth.forgot.redirecting')}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Back to login */}
        <div className="my-6 text-center">
          <span className="text-sm text-muted-foreground">{t('auth.forgot.rememberPassword')}</span>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/auth/login', { state: { from: { pathname: from } } })}
          className="h-12 w-full rounded-md border-input bg-transparent text-base text-foreground hover:border-primary hover:text-primary"
        >
          {t('auth.forgot.backToLogin')}
        </Button>
      </motion.div>
    </>
  );
};

export default ForgotPassword;
