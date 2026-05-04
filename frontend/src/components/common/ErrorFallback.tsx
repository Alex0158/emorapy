import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/utils/i18n';

interface Props {
  error?: Error;
  resetError: () => void;
}

const ErrorFallback = ({ error, resetError }: Props) => {
  const isDev = import.meta.env.DEV;
  const message = isDev && error?.message ? error.message : t('errorFallback.unknown');
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertCircle className="size-12 text-destructive" />
      <h2 className="text-xl font-bold text-foreground">{t('errorFallback.title')}</h2>
      <p className="text-sm text-muted-foreground max-w-md">{message}</p>
      <div className="flex gap-2">
        <Button onClick={resetError}><RefreshCw className="size-4" />{t('errorFallback.retry')}</Button>
        <Button variant="outline" onClick={() => location.reload()}>{t('errorFallback.reload')}</Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('errorFallback.hint')}</p>
    </div>
  );
};

export default ErrorFallback;
