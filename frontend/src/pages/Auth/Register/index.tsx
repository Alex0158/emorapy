/**
 * 註冊頁面
 *
 * 遷移: legacy form controls → shadcn/ui + 原生表單
 * 保留: 3 步驟流程（郵箱→驗證碼→密碼）、所有業務邏輯
 * 新增: 密碼強度指示器
 */

import { Eye, EyeOff, Mail, User, Lock } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SEO from '@/components/common/SEO';
import { sendVerificationCode, verifyEmail } from '@/services/api/auth';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';

const CODE_LENGTH = 6;

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
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mountedRef = useMountedRef();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const registerLockRef = useRef(false);
  const sendCodeLockRef = useRef(false);

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

  const handleSendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!email) { setErrors({ email: t('auth.register.emailRequired') }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErrors({ email: t('auth.register.emailInvalid') }); return; }
    if (sendCodeLockRef.current) return;
    sendCodeLockRef.current = true;
    setSendingCode(true);
    try {
      await sendVerificationCode(email, 'register');
      if (!mountedRef.current) return;
      startCountdown();
      toast.success(t('message.codeSent'));
      setCurrentStep(1);
    } catch (error: unknown) {
      if (mountedRef.current) toast.error(getErrorMessage(error, 'message.sendCodeFail'));
    } finally {
      sendCodeLockRef.current = false;
      if (mountedRef.current) setSendingCode(false);
    }
  };

  const handleResendCode = () => {
    if (countdown > 0) { toast.warning(t('message.waitCountdown').replace('{count}', String(countdown))); return; }
    handleSendCode();
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
    setVerifying(true);
    try {
      const verified = await verifyEmail(email, code, 'register');
      if (!mountedRef.current) return;
      if (verified) { toast.success(t('message.verifySuccess')); setCurrentStep(2); }
      else { toast.error(t('message.codeError')); setVerificationCode(Array(CODE_LENGTH).fill('')); codeInputRefs.current[0]?.focus(); }
    } catch (error: unknown) {
      if (mountedRef.current) toast.error(getErrorMessage(error, 'message.verifyFail'));
    } finally { if (mountedRef.current) setVerifying(false); }
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

    if (registerLockRef.current) return;
    registerLockRef.current = true;
    try {
      await register(email, password, nickname || undefined);
      if (!mountedRef.current) return;
      toast.success(t('message.registerSuccess'));
      navigate(redirectTo, { replace: true });
    } catch (error: unknown) {
      if (mountedRef.current) toast.error(getErrorMessage(error, 'message.registerFail'));
    } finally { registerLockRef.current = false; }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <>
      <SEO title={t('auth.register.title')} description={t('auth.register.description')} keywords={t('auth.register.keywords')} />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="w-full"
        role="main"
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
        <div className="mb-8 flex items-center gap-2">
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
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="email"
                    aria-label={t('auth.register.email')}
                    placeholder={t('auth.register.emailPlaceholder')}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors({}); }}
                    className="h-12 rounded-2xl border-black/5 bg-white/70 pl-11 text-base shadow-[inset_0_2px_8px_rgba(0,0,0,0.01)] transition-all duration-300 hover:bg-white/90 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                </div>
                {errors.email && <p className="text-sm text-destructive pl-1">{errors.email}</p>}
              </div>

              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  aria-label={t('auth.register.nickname')}
                  autoComplete="nickname"
                  placeholder={t('auth.register.nicknamePlaceholder')}
                  maxLength={20}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="h-12 rounded-2xl border-black/5 bg-white/70 pl-11 text-base shadow-[inset_0_2px_8px_rgba(0,0,0,0.01)] transition-all duration-300 hover:bg-white/90 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/15"
                />
              </div>

              <Button
                type="submit"
                disabled={sendingCode}
                className="h-[52px] w-full rounded-2xl bg-gradient-to-br from-primary to-primary-hover text-base font-semibold shadow-[0_8px_20px_oklch(0.65_0.15_25/0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_oklch(0.65_0.15_25/0.3)] active:translate-y-0 mt-2"
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
                    className="h-14 w-12 rounded-xl border border-border bg-muted/50 text-center text-xl font-bold text-foreground transition-all duration-200 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/15 focus:outline-none"
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
                  disabled={countdown > 0}
                  className="mt-2 text-sm font-medium text-primary hover:text-primary-hover disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
                >
                  {t('auth.register.resendCode')}
                </button>
              </div>

              <Button
                onClick={handleVerifyCode}
                disabled={verificationCode.join('').length !== CODE_LENGTH || verifying}
                className="h-[52px] w-full rounded-2xl bg-gradient-to-br from-primary to-primary-hover text-base font-semibold shadow-[0_8px_20px_oklch(0.65_0.15_25/0.25)] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
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
              {/* Password */}
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    aria-label={t('auth.register.setPassword')}
                    placeholder={t('auth.register.passwordPlaceholder')}
                    maxLength={128}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((prev) => { const { password: _, ...rest } = prev; return rest; }); }}
                    className="h-12 rounded-2xl border-black/5 bg-white/70 pl-11 pr-11 text-base shadow-[inset_0_2px_8px_rgba(0,0,0,0.01)] transition-all duration-300 hover:bg-white/90 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive pl-1">{errors.password}</p>}
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
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    aria-label={t('auth.register.confirmPassword')}
                    placeholder={t('auth.register.confirmPlaceholder')}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrors((prev) => { const { confirmPassword: _, ...rest } = prev; return rest; }); }}
                    className="h-12 rounded-2xl border-black/5 bg-white/70 pl-11 text-base shadow-[inset_0_2px_8px_rgba(0,0,0,0.01)] transition-all duration-300 hover:bg-white/90 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                </div>
                {errors.confirmPassword && <p className="text-sm text-destructive pl-1">{errors.confirmPassword}</p>}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-[52px] w-full rounded-2xl bg-gradient-to-br from-primary to-primary-hover text-base font-semibold shadow-[0_8px_20px_oklch(0.65_0.15_25/0.25)] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 mt-2"
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
          className="h-[52px] w-full rounded-2xl border-black/5 bg-white/50 text-base font-semibold text-foreground transition-all duration-300 hover:border-primary/30 hover:bg-white hover:text-primary hover:shadow-sm"
        >
          {t('auth.register.loginNow')}
        </Button>
      </motion.div>
    </>
  );
};

export default Register;
