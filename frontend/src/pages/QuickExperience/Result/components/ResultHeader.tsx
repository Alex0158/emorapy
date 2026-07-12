import { t } from '@/utils/i18n';

const ResultHeader = () => (
  <header className="border-l border-primary pl-6 md:pl-10" aria-labelledby="result-title">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t('result.eyebrow')}</p>
    <h1 id="result-title" className="mt-3 text-4xl font-semibold tracking-[-0.03em] md:text-5xl">{t('result.title')}</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{t('result.subtitle')}</p>
  </header>
);

export default ResultHeader;
