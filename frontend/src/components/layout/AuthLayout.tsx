import { Globe, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import BrandMark from '@/components/common/BrandMark';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getLocale, onLocaleChange, setLocale, t, type Locale } from '@/utils/i18n';

const AuthLayout = () => {
  const [locale, setLocalLocale] = useState<Locale>(getLocale());

  useEffect(() => {
    const unsubscribe = onLocaleChange(() => setLocalLocale(getLocale()));
    return unsubscribe;
  }, []);

  const handleLocaleChange = useCallback((value: string) => {
    setLocalLocale(value as Locale);
    setLocale(value as Locale);
  }, []);

  return (
    <div className="min-h-screen bg-background px-5 py-5 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <BrandMark />
        <Select value={locale} onValueChange={handleLocaleChange}>
          <SelectTrigger
            className="h-11 w-[142px] rounded-md border-border bg-transparent text-sm"
            aria-label={t('auth.locale.ariaLabel')}
          >
            <Globe className="size-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="zh-TW">{t('auth.locale.zhTW')}</SelectItem>
            <SelectItem value="en-US">{t('auth.locale.enUS')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <main className="mx-auto grid max-w-6xl gap-8 py-8 md:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.75fr)] md:items-center md:gap-10 md:py-20 lg:gap-20">
        <section className="order-1 flex items-start gap-3 border-l border-primary pl-4 text-sm leading-6 text-muted-foreground md:hidden">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
          <p>{t('auth.brand.safetyScope')}</p>
        </section>

        <section className="order-2 border-t border-border pt-8 md:border-l md:border-t-0 md:pl-10 md:pt-0">
          <div className="mx-auto w-full max-w-[420px]">
            <Outlet />
          </div>
        </section>

        <section className="order-3 max-w-xl border-l border-primary pl-6 md:order-1 md:pl-10" aria-labelledby="auth-context-title">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t('auth.brand.eyebrow')}
          </p>
          <h1 id="auth-context-title" className="max-w-lg text-4xl font-semibold leading-[1.12] tracking-[-0.025em] md:text-6xl">
            {t('auth.brand.taglineLine1')} {t('auth.brand.taglineLine2')}
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">
            {t('auth.brand.scopeDescription')}
          </p>
          <div className="mt-8 hidden max-w-md items-start gap-3 border-t border-border pt-5 text-sm leading-6 text-muted-foreground md:flex">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
            <p>{t('auth.brand.safetyScope')}</p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AuthLayout;
