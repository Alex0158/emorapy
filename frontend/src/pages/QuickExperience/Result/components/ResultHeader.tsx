import MediatorAvatar from '@/components/business/MediatorAvatar';
import { t } from '@/utils/i18n';

const ResultHeader = () => {
  return (
    <section className="mb-8 text-center" aria-labelledby="result-title">
      <MediatorAvatar size="large" animated />
      <h1 id="result-title" className="mt-4 text-3xl font-bold text-foreground font-heading">{t('result.title')}</h1>
      <p className="mt-2 text-base text-muted-foreground">{t('result.subtitle')}</p>
    </section>
  );
};

export default ResultHeader;
