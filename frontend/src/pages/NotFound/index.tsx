/**
 * 404 頁面
 */

import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/utils/i18n';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <main className="mx-auto flex min-h-[72vh] max-w-3xl items-center px-5 py-16">
      <div className="w-full border-l border-primary pl-6 md:pl-10">
        <p className="font-heading text-sm text-primary">404</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-[-0.035em] text-foreground md:text-6xl">{t('notFound.title')}</h1>
        <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">{t('notFound.subTitle')}</p>
        <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Button onClick={() => navigate('/')}><Home className="size-4" />{t('notFound.backHome')}</Button>
          <button type="button" onClick={() => navigate(-1)} className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />{t('notFound.backPrevious')}
          </button>
          <button type="button" onClick={() => navigate('/quick-experience/create')} className="min-h-11 px-2 text-sm font-semibold text-muted-foreground underline decoration-border underline-offset-8 hover:text-foreground hover:decoration-primary">
            {t('notFound.goQuickExperience')}
          </button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
