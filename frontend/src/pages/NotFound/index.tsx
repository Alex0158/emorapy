/**
 * 404 頁面
 */

import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/utils/i18n';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <span className="text-6xl font-bold text-muted-foreground/20">404</span>
      <h1 className="mt-4 text-2xl font-bold text-foreground">{t('notFound.title')}</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">{t('notFound.subTitle')}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={() => navigate('/')}><Home className="size-4" />{t('notFound.backHome')}</Button>
        <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="size-4" />{t('notFound.backPrevious')}</Button>
        <Button variant="outline" onClick={() => navigate('/quick-experience/create')}><Rocket className="size-4" />{t('notFound.goQuickExperience')}</Button>
      </div>
    </div>
  );
};

export default NotFound;
