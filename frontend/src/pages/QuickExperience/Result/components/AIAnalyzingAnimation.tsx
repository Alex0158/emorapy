import { Loader2 } from 'lucide-react';
import { t } from '@/utils/i18n';

export default function AIAnalyzingAnimation() {
  return (
    <div className="w-full max-w-xl border-l border-primary pl-6 text-left md:pl-10" role="status" aria-live="polite">
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
      <h1 className="mt-6 text-4xl font-semibold tracking-[-0.03em]">{t('quickResult.analyzingTitle')}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('quickResult.analyzingSubtitle')}</p>
    </div>
  );
}
