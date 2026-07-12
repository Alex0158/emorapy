/**
 * 登錄頁面
 *
 * 遷移: legacy form controls → shadcn/ui + 原生表單
 * 保留: 所有業務邏輯（login, redirect, email verification）
 */

import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useState, useRef, type FormEvent } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SEO from '@/components/common/SEO';
import { sendVerificationCode } from '@/services/api/auth';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';

interface LocationState {
  from?: { pathname: string };
}

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const mountedRef = useMountedRef();
  const loginLockRef = useRef(false);

  const VALID_REDIRECT_PREFIXES = [
    '/case', '/judgment', '/reconciliation', '/execution',
    '/profile', '/interview', '/quick-experience', '/chat',
  ];
  const state = location.state as LocationState | null;
  const rawFrom = state?.from?.pathname || '/case/list';
  const isValidRedirect =
    rawFrom === '/' ||
    VALID_REDIRECT_PREFIXES.some((prefix) => rawFrom.startsWith(prefix));
  const from = isValidRedirect ? rawFrom : '/case/list';

  const validate = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) {
      newErrors.email = t('auth.login.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('auth.login.emailInvalid');
    }
    if (!password) {
      newErrors.password = t('auth.login.passwordRequired');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (loginLockRef.current) return;
    loginLockRef.current = true;
    try {
      await login(email, password, rememberMe);
      if (!mountedRef.current) return;
      toast.success(t('message.loginSuccess'));
      navigate(from, { replace: true });
    } catch (error: unknown) {
      const err =
        error && typeof error === 'object'
          ? (error as { code?: string; message?: string })
          : null;
      const code = err?.code;
      const msgStr = getErrorMessage(error, 'message.loginFail');
      const looksLikeEmailNotVerified =
        code === 'EMAIL_NOT_VERIFIED' ||
        /郵箱驗證|email verification|not verified/i.test(msgStr);

      if (!mountedRef.current) return;

      if (looksLikeEmailNotVerified) {
        toast.warning(t('message.emailNotVerified'));
        try {
          await sendVerificationCode(email, 'verify_email');
        } catch (sendErr: unknown) {
          if (!mountedRef.current) return;
          toast.error(getErrorMessage(sendErr, 'message.resendVerifyFail'));
        }
      } else {
        toast.error(msgStr);
      }
    } finally {
      loginLockRef.current = false;
    }
  };

  return (
    <>
      <SEO
        title={t('auth.login.title')}
        description={t('auth.login.description')}
        keywords={t('auth.login.keywords')}
      />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="w-full"
        role="region"
        aria-label={t('auth.login.pageLabel')}
      >
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-foreground font-heading">
            {t('auth.login.welcome')}
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            {t('auth.login.subtitle')}
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5"
          aria-label={t('auth.login.formLabel')}
          noValidate
        >
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="login-email" className="sr-only">
              {t('auth.login.email')}
            </Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="login-email"
                type="email"
                placeholder={t('auth.login.email')}
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: undefined })); }}
                className="h-12 rounded-md border-input bg-transparent pl-11 text-base placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
              />
            </div>
            {errors.email && (
              <p id="login-email-error" className="text-sm text-destructive pl-1">
                {errors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="login-password" className="sr-only">
              {t('auth.login.password')}
            </Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.login.password')}
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((prev) => ({ ...prev, password: undefined })); }}
                className="h-12 rounded-md border-input bg-transparent pl-11 pr-11 text-base placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'login-password-error' : undefined}
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
            {errors.password && (
              <p id="login-password-error" className="text-sm text-destructive pl-1">
                {errors.password}
              </p>
            )}
          </div>

          {/* Remember me + Forgot password */}
          <div className="flex items-center justify-between">
            <label className="flex min-h-11 cursor-pointer select-none items-center gap-2">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30 accent-primary"
              />
              <span className="text-sm text-muted-foreground">
                {t('auth.login.rememberMe')}
              </span>
            </label>
            <button
              type="button"
              onClick={() => navigate('/auth/forgot-password', { state: { from: { pathname: from } } })}
              className="min-h-11 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {t('auth.login.forgotPassword')}
            </button>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={isLoading}
            className="h-12 w-full rounded-md text-base"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {t('common.loading')}
              </span>
            ) : (
              t('auth.login.submit')
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="my-6 text-center">
          <span className="text-sm text-muted-foreground">
            {t('auth.login.noAccount')}
          </span>
        </div>

        {/* Switch to Register */}
        <Button
          variant="outline"
          onClick={() => navigate('/auth/register', { state: { from: { pathname: from } } })}
          className="h-12 w-full rounded-md border-input bg-transparent text-base text-foreground hover:border-primary hover:text-primary"
        >
          {t('auth.login.registerNow')}
        </Button>
      </motion.div>
    </>
  );
};

export default Login;
