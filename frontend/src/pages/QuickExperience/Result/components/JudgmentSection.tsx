import { toast } from 'sonner';
import JudgmentViewer from '@/components/business/JudgmentViewer';
import { t } from '@/utils/i18n';

type Props = { content: string };

const JudgmentSection = ({ content }: Props) => {
  return (
    <section id="judgment-section" className="mb-6" aria-labelledby="judgment-title">
      <h3 id="judgment-title" className="mb-4 text-lg font-semibold text-foreground font-heading">{t('judgment.title')}</h3>
      <JudgmentViewer
        content={content}
        title={undefined}
        onShare={() => toast.info(t('message.shareComingSoon'))}
        onFavorite={() => toast.info(t('message.favoriteNeedRegister'))}
        showActions={true}
      />
    </section>
  );
};

export default JudgmentSection;
