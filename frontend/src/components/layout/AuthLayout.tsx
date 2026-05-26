/**
 * 認證布局（居中毛玻璃卡片式）
 *
 * 遷移: legacy select / stylesheet → shadcn Select + Tailwind
 * 保留: Framer Motion 動畫、毛玻璃效果、品牌側/表單側雙欄結構
 */

import { Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FBF5F1] p-4 md:p-6">
      {/* Immersive Ambient Background */}
      <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-[10%] -top-[10%] h-[60vw] w-[60vw] animate-[float-orb_20s_ease-in-out_infinite_alternate] rounded-full bg-primary/25 blur-[100px]" />
        <div className="absolute -bottom-[20%] -left-[10%] h-[50vw] w-[50vw] animate-[float-orb_20s_ease-in-out_infinite_alternate-reverse] rounded-full bg-secondary/15 blur-[100px] [animation-delay:-5s]" />
        <div className="absolute left-[30%] top-[40%] h-[40vw] w-[40vw] animate-[float-orb_20s_ease-in-out_infinite_alternate] rounded-full bg-accent/20 blur-[100px] [animation-delay:-10s]" />
        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_90%_85%_at_50%_50%,transparent_35%,oklch(0.65_0.15_25/0.04)_100%)]" />
      </div>

      {/* Main Glass Container */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex w-full max-w-[1000px] min-h-[600px] overflow-hidden rounded-[32px] border border-white/60 bg-white/40 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.1),inset_0_0_0_1px_rgba(255,255,255,0.3)] backdrop-blur-[40px] max-md:min-h-0 max-md:flex-col max-md:rounded-3xl max-md:bg-white/85"
      >
        {/* Locale Switch */}
        <div className="absolute right-4 top-4 z-20">
          <Select value={locale} onValueChange={handleLocaleChange}>
            <SelectTrigger
              className="w-[130px] rounded-full border-black/8 bg-white/80 shadow-sm text-sm"
              aria-label={t('auth.locale.ariaLabel')}
            >
              <Globe className="size-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zh-TW">{t('auth.locale.zhTW')}</SelectItem>
              <SelectItem value="en-US">{t('auth.locale.enUS')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Brand Side (Left) — Hidden on mobile */}
        <div className="relative flex flex-[5] flex-col justify-between overflow-hidden rounded-l-[32px] bg-gradient-to-br from-primary to-primary-hover p-12 lg:p-16 shadow-[inset_-1px_0_0_rgba(255,255,255,0.2)] max-md:hidden">
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-12 flex items-center"
            >
              <span className="text-3xl">✨</span>
              <span className="ml-2 text-2xl font-bold tracking-wide text-white font-heading">
                {t('nav.logo')}
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <h1 className="mb-6 text-4xl font-bold leading-[1.15] tracking-tight text-white font-heading lg:text-5xl">
                {t('auth.brand.taglineLine1')} <br />
                <span className="font-normal italic text-white/85">
                  {t('auth.brand.taglineLine2')}
                </span>
              </h1>
              <p className="max-w-[320px] text-lg font-light leading-relaxed text-white/90">
                {t('auth.brand.descriptionLine1')}
                <br />
                {t('auth.brand.descriptionLine2')}
              </p>
            </motion.div>
          </div>

          {/* Decorative blur */}
          <div className="pointer-events-none absolute -bottom-[50px] -right-[50px] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,oklch(0.75_0.14_75/0.4)_0%,transparent_70%)] blur-[40px]" />
        </div>

        {/* Form Side (Right) */}
        <div className="flex flex-[7] items-center justify-center rounded-r-[32px] bg-white/70 p-8 max-md:rounded-none max-md:p-6 max-md:pt-14">
          <div className="w-full max-w-[400px]">
            <Outlet />
          </div>
        </div>
      </motion.div>

      {/* Float orb keyframes — injected via Tailwind arbitrary animation */}
      <style>{`
        @keyframes float-orb {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(3vw, 5vh) scale(1.05); }
          66% { transform: translate(-2vw, 2vh) scale(0.95); }
          100% { transform: translate(1vw, -3vh) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default AuthLayout;
