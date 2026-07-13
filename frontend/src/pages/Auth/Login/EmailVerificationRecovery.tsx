import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { t } from '@/utils/i18n';

interface EmailVerificationRecoveryProps {
  busy: boolean;
  code: string;
  email: string;
  error: string | null;
  onBack: () => void;
  onCodeChange: (code: string) => void;
  onResend: () => void;
  onVerify: () => void;
  resendAvailableAt: number;
}

export function EmailVerificationRecovery({
  busy,
  code,
  email,
  error,
  onBack,
  onCodeChange,
  onResend,
  onVerify,
  resendAvailableAt,
}: EmailVerificationRecoveryProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (resendAvailableAt <= now) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [now, resendAvailableAt]);

  const resendRemaining = Math.max(0, Math.ceil((resendAvailableAt - now) / 1_000));
  const canVerify = /^\d{6}$/.test(code) && !busy;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canVerify) onVerify();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-label={t('auth.login.verify.formLabel')}>
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <MailCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground">{t('auth.login.verify.title')}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t('auth.login.verify.description').replace('{email}', email)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-verification-code">{t('auth.login.verify.codeLabel')}</Label>
        <Input
          id="login-verification-code"
          autoComplete="one-time-code"
          autoFocus
          disabled={busy}
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={t('auth.login.verify.codePlaceholder')}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'login-verification-error' : 'login-verification-help'}
          className="h-12 text-center text-lg tracking-[0.35em]"
        />
        {error ? (
          <p id="login-verification-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : (
          <p id="login-verification-help" className="text-sm text-muted-foreground">
            {t('auth.login.verify.codeHelp')}
          </p>
        )}
      </div>

      <Button type="submit" disabled={!canVerify} className="h-12 w-full rounded-md text-base">
        {busy ? t('common.loading') : t('auth.login.verify.submit')}
      </Button>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" disabled={busy} onClick={onBack} className="justify-start">
          <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
          {t('auth.login.verify.back')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy || resendRemaining > 0}
          onClick={onResend}
        >
          {resendRemaining > 0
            ? t('auth.login.verify.resendWait').replace('{seconds}', String(resendRemaining))
            : t('auth.login.verify.resend')}
        </Button>
      </div>
    </form>
  );
}
