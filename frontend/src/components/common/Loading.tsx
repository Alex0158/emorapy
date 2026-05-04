/**
 * 加載組件（已遷移到 Lucide Loader2）
 */

import { Loader2 } from 'lucide-react';
import { t } from '@/utils/i18n';

const Loading = () => {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
      <Loader2 className="size-8 animate-spin text-primary" />
      <span className="text-sm text-muted-foreground">{t('common.loading')}</span>
    </div>
  );
};

export default Loading;
