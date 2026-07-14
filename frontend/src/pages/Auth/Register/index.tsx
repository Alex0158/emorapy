/**
 * 註冊頁面
 *
 * 遷移: legacy form controls → shadcn/ui + 原生表單
 * 保留: 3 步驟流程（郵箱→驗證碼→密碼）、所有業務邏輯
 * 新增: 密碼強度指示器
 */

import { Check, Eye, EyeOff, Mail, User, Lock } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SEO from '@/components/common/SEO';
import { sendVerificationCode, verifyRegistrationCode } from '@/services/api/auth';
import { useAuthStore } from '@/store/authStore';
import { getErrorCode, getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';

const CODE_LENGTH = 6;
const REGISTRATION_PROOF_ERRORS = new Set([
  'REGISTRATION_PROOF_INVALID',
  'REGISTRATION_PROOF_EXPIRED',
]);

interface LocationState {
  from?: { pathname: string };
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 15;
  if (/[A-Z]/.test(password)) score += 20;
  if (/[a-z]/.test(password)) score += 10;
  if (/\d/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;

  if (score < 30) return { score, label: t('password.strength.weak'), color: 'bg-destructive' };
  if (score < 60) return { score, label: t('password.strength.medium'), color: 'bg-warning' };
  if (score < 80) return { score, label: t('password.strength.strong'), color: 'bg-success' };
  return { score: Math.min(score, 100), label: t('password.strength.veryStrong'), color: 'bg-success' };
}

const stepVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, isLoading } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [registrationProof, setRegistrationProof] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mountedRef = useMountedRef();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const registerLockRef = useRef(false);
  const sendCodeLockRef = useRef(false);
  const verifyCodeLockRef = useRef(false);
  const verificationRequestRef = useRef(0);

  const VALID_REDIRECT_PREFIXES = [
    '/case', '/judgment', '/reconciliation', '/execution',
    '/profile', '/interview', '/quick-experience', '/chat',
  ];
  const state = location.state as LocationState | null;
  const rawFrom = state?.from?.pathname || '/profile/pairing';
  const isValidRedirect =
    rawFrom === '/' || VALID_REDIRECT_PREFIXES.some((prefix) => rawFrom.startsWith(prefix));
  const redirectTo = isValidRedirect ? rawFrom : '/profile/pairing';

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const stopCountdown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setCountdown(0);
    setResendCountdown(0);
  }, []);

  const startCountdown = useCallback((expiresIn: number, resendAfter: number) => {
    setCountdown(expiresIn);
    setResendCountdown(resendAfter);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1));
      setCountdown((prev) => {
        if (prev <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!email) { setErrors({ email: t('auth.register.emailRequired') }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErrors({ email: t('auth.register.emailInvalid') }); return; }
    if (sendCodeLockRef.current) return;
    sendCodeLockRef.current = true;
    const requestId = ++verificationRequestRef.current;
    setVerifying(false);
    setRegistrationProof(null);
    setVerificationCode(Array(CODE_LENGTH).fill(''));
    setSendingCode(true);
    try {
      const delivery = await sendVerificationCode(email, 'register');
      if (!mountedRef.current || requestId !== verificationRequestRef.current) return;
      startCountdown(delivery.expires_in, delivery.resend_after);
      toast.success(t('message.codeSent'));
      setCurrentStep(1);
    } catch (error: unknown) {
      if (mountedRef.current && requestId === verificationRequestRef.current) {
        toast.error(getErrorMessage(error, 'message.sendCodeFail'));
      }
    } finally {
      sendCodeLockRef.current = false;
      if (mountedRef.current) setSendingCode(false);
    }
  };

  const handleResendCode = () => {
    if (resendCountdown > 0) {
      toast.warning(t('message.waitCountdown').replace('{count}', String(resendCountdown)));
      return;
    }
    if (sendingCode || verifying) return;
    void handleSendCode();
  };

  const handleChangeEmail = () => {
    if (registerLockRef.current) return;
    verificationRequestRef.current += 1;
    setVerifying(false);
    setRegistrationProof(null);
    setVerificationCode(Array(CODE_LENGTH).fill(''));
    stopCountdown();
    setErrors({});
    setCurrentStep(0);
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
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

  const handleVerifyCode = async () => {
    const code = verificationCode.join('');
    if (code.length !== CODE_LENGTH) { toast.error(t('message.codeFull')); return; }
    if (verifyCodeLockRef.current) return;
    verifyCodeLockRef.current = true;
    const requestId = ++verificationRequestRef.current;
    setVerifying(true);
    try {
      const result = await verifyRegistrationCode(email, code);
      if (!mountedRef.current || requestId !== verificationRequestRef.current) return;
      setRegistrationProof(result.registration_proof);
      stopCountdown();
      toast.success(t('message.verifySuccess'));
      setCurrentStep(2);
    } catch (error: unknown) {
      if (mountedRef.current && requestId === verificationRequestRef.current) {
        const errorCode = getErrorCode(error);
        if (errorCode === 'INVALID_CODE' || errorCode === 'CODE_EXPIRED') {
          setVerificationCode(Array(CODE_LENGTH).fill(''));
          codeInputRefs.current[0]?.focus();
        }
        toast.error(getErrorMessage(error, 'message.verifyFail'));
      }
    } finally {
      verifyCodeLockRef.current = false;
      if (mountedRef.current && requestId === verificationRequestRef.current) setVerifying(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!password) newErrors.password = t('auth.login.passwordRequired');
    else if (password.length < 8) newErrors.password = t('auth.register.passwordMin');
    else if (!/^(?=.*[A-Za-z])(?=.*\d)/.test(password)) newErrors.password = t('auth.register.passwordPattern');
    if (!confirmPassword) newErrors.confirmPassword = t('auth.register.confirmRequired');
    else if (password !== confirmPassword) newErrors.confirmPassword = t('message.passwordMismatch');
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    if (!registrationProof) {
      setVerificationCode(Array(CODE_LENGTH).fill(''));
      stopCountdown();
      setCurrentStep(1);
      toast.error(t('message.verifyFail'));
      return;
    }

    if (registerLockRef.current) return;
    registerLockRef.current = true;
    try {
      await register({
        email,
        password,
        registration_proof: registrationProof,
        nickname: nickname || undefined,
      });
      if (!mountedRef.current) return;
      toast.success(t('message.registerSuccess'));
      navigate(redirectTo, { replace: true });
    } catch (error: unknown) {
      if (mountedRef.current) {
        if (REGISTRATION_PROOF_ERRORS.has(getErrorCode(error))) {
          setRegistrationProof(null);
          setVerificationCode(Array(CODE_LENGTH).fill(''));
          stopCountdown();
          setCurrentStep(1);
        }
        toast.error(getErrorMessage(error, 'message.registerFail'));
      }
    } finally { registerLockRef.current = false; }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const passwordStrength = getPasswordStrength(password);
  const stepLabels = [
    t('auth.register.stepEmail'),
    t('auth.register.stepVerify'),
    t('auth.register.stepPassword'),
  ];

  return (
    <>
      <SEO title={t('auth.register.title')} description={t('auth.register.description')} keywords={t('auth.register.keywords')} />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="w-full"
        role="region"
        aria-label={t('auth.register.pageLabel')}
      >
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold tracking-tight text-foreground font-heading">
            {t('auth.register.welcome')}
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            {t('auth.register.subtitle')}
          </p>
        </div>

        {/* Step Indicator */}
        <ol className="mb-8 flex items-start gap-2" aria-label={t('auth.register.progressLabel')}>
          {[0, 1, 2].map((step) => {
            const isCompleted = step < currentStep;
            const isCurrent = step === currentStep;
            return (
              <li
                key={step}
                className="flex flex-1 items-start gap-2"
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                    isCompleted
                      ? 'border-secondary bg-secondary text-secondary-foreground'
                      : isCurrent
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground'
                  }`} aria-hidden="true">
                    {isCompleted ? <Check className="size-3.5" /> : step + 1}
                  </span>
                  <span className={`text-[11px] leading-4 ${
                    isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'
                  }`}>
                    {stepLabels[step]}
                  </span>
                </div>
                {step < 2 && (
                  <div className={`mt-3.5 h-0.5 flex-1 rounded-full transition-colors ${
                    isCompleted ? 'bg-secondary' : 'bg-muted'
                  }`} aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>

        {/* Steps content */}
        <AnimatePresence mode="wait">
          {currentStep === 0 && (
            <motion.form
              key="step-email"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onSubmit={handleSendCode}
              className="space-y-5"
              noValidate
            >
              <div className="space-y-2">
                <Label htmlFor="register-email">{t('auth.register.email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="register-email"
                    type="email"
                    placeholder={t('auth.register.emailPlaceholder')}
                    autoComplete="email"
                    value={email}
                    disabled={sendingCode}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'register-email-error' : undefined}
                    onChange={(e) => {
                      verificationRequestRef.current += 1;
                      setEmail(e.target.value);
                      setRegistrationProof(null);
                      setVerificationCode(Array(CODE_LENGTH).fill(''));
                      setErrors({});
                    }}
                    className="h-12 rounded-md border-input bg-transparent pl-11 text-base focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </div>
                {errors.email && <p id="register-email-error" className="text-sm text-destructive pl-1">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-nickname">{t('auth.register.nickname')}</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="register-nickname"
                    type="text"
                    autoComplete="nickname"
                    placeholder={t('auth.register.nicknamePlaceholder')}
                    maxLength={20}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="h-12 rounded-md border-input bg-transparent pl-11 text-base focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={sendingCode}
                className="mt-2 h-12 w-full rounded-md text-base"
              >
                {sendingCode ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {t('common.loading')}
                  </span>
                ) : t('auth.register.sendCode')}
              </Button>
            </motion.form>
          )}

          {currentStep === 1 && (
            <motion.div
              key="step-verify"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{t('auth.register.codeSentTo')}</p>
                <p className="mt-1 text-base font-semibold text-foreground">{email}</p>
                <button
                  type="button"
                  onClick={handleChangeEmail}
                  disabled={verifying || sendingCode}
                  className="mt-1 min-h-11 px-2 text-sm font-medium text-primary transition-colors hover:text-primary-hover disabled:cursor-not-allowed disabled:text-muted-foreground"
                >
                  {t('auth.register.changeEmail')}
                </button>
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
                    disabled={verifying}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(index, e)}
                    onPaste={handleCodePaste}
                    className="h-14 w-12 rounded-md border border-input bg-transparent text-center text-xl font-bold text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                    aria-label={`${t('auth.register.stepVerify')} ${index + 1}`}
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
                  disabled={resendCountdown > 0 || sendingCode || verifying}
                  className="mt-2 min-h-11 px-2 text-sm font-medium text-primary transition-colors hover:text-primary-hover disabled:cursor-not-allowed disabled:text-muted-foreground"
                >
                  {resendCountdown > 0
                    ? `${t('auth.register.resendCode')} · ${formatCountdown(resendCountdown)}`
                    : t('auth.register.resendCode')}
                </button>
              </div>

              <Button
                onClick={handleVerifyCode}
                disabled={verificationCode.join('').length !== CODE_LENGTH || verifying}
                className="h-12 w-full rounded-md text-base"
              >
                {verifying ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {t('common.loading')}
                  </span>
                ) : t('auth.register.verifyAndContinue')}
              </Button>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.form
              key="step-password"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onSubmit={handleSubmit}
              className="space-y-5"
              noValidate
            >
              <div className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-2 text-sm">
                <span className="truncate text-muted-foreground">{email}</span>
                <button
                  type="button"
                  onClick={handleChangeEmail}
                  disabled={isLoading}
                  className="min-h-11 shrink-0 px-2 font-medium text-primary transition-colors hover:text-primary-hover disabled:cursor-not-allowed disabled:text-muted-foreground"
                >
                  {t('auth.register.changeEmail')}
                </button>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="register-password">{t('auth.register.setPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('auth.register.passwordPlaceholder')}
                    maxLength={128}
                    autoComplete="new-password"
                    value={password}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'register-password-error' : undefined}
                    onChange={(e) => { setPassword(e.target.value); setErrors((prev) => { const { password: _, ...rest } = prev; return rest; }); }}
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
                {errors.password && <p id="register-password-error" className="text-sm text-destructive pl-1">{errors.password}</p>}
                {/* Password strength indicator */}
                {password && (
                  <div className="space-y-1 pt-1">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${passwordStrength.color}`}
                        style={{ width: `${passwordStrength.score}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('password.strengthLabel')}<span className="font-medium">{passwordStrength.label}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="register-confirm-password">{t('auth.register.confirmPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="register-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('auth.register.confirmPlaceholder')}
                    autoComplete="new-password"
                    value={confirmPassword}
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={errors.confirmPassword ? 'register-confirm-password-error' : undefined}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrors((prev) => { const { confirmPassword: _, ...rest } = prev; return rest; }); }}
                    className="h-12 rounded-md border-input bg-transparent pl-11 text-base focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </div>
                {errors.confirmPassword && <p id="register-confirm-password-error" className="text-sm text-destructive pl-1">{errors.confirmPassword}</p>}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="mt-2 h-12 w-full rounded-md text-base"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {t('common.loading')}
                  </span>
                ) : t('auth.register.finishRegister')}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Divider + Login link */}
        <div className="my-6 text-center">
          <span className="text-sm text-muted-foreground">{t('auth.register.hasAccount')}</span>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/auth/login', { state: { from: { pathname: redirectTo } } })}
          className="h-12 w-full rounded-md border-input bg-transparent text-base text-foreground hover:border-primary hover:text-primary"
        >
          {t('auth.register.loginNow')}
        </Button>
      </motion.div>
    </>
  );
};

export default Register;
