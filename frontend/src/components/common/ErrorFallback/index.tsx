/**
 * 錯誤回退組件（路由級 ErrorBoundary 使用）
 */

import { useNavigate } from 'react-router-dom';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/utils/i18n';

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

const ErrorFallback = ({ error, resetError }: ErrorFallbackProps) => {
  const navigate = useNavigate();
  const isDev = import.meta.env.DEV;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertCircle className="size-12 text-destructive" />
      <h2 className="text-xl font-bold text-foreground">{t('error.occurred')}</h2>
      <p className="text-sm text-muted-foreground max-w-md">{isDev ? (error?.message || t('error.appCrash')) : t('error.appCrash')}</p>
      <div className="flex gap-2">
        <Button onClick={() => { navigate('/'); resetError?.(); }}><Home className="size-4" />{t('common.backHome')}</Button>
        <Button variant="outline" onClick={() => window.location.reload()}><RefreshCw className="size-4" />{t('common.reload')}</Button>
      </div>
    </div>
  );
};

export default ErrorFallback;
