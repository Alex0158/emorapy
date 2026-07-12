import ResponsibilityRatio from '@/components/business/ResponsibilityRatio';
import { t } from '@/utils/i18n';

type Ratio = { plaintiff: number; defendant: number };
type Props = { ratio: Ratio; showLabels?: boolean; size?: 'small' | 'medium' | 'large' };

const ResponsibilitySection = ({ ratio, showLabels = true, size = 'large' }: Props) => {
  return (
    <section className="mb-6 border-y border-border py-6" aria-labelledby="responsibility-title">
      <h3 id="responsibility-title" className="mb-4 text-lg font-semibold text-foreground font-heading">{t('responsibility.title')}</h3>
      <ResponsibilityRatio ratio={ratio} showLabels={showLabels} size={size} />
    </section>
  );
};

export default ResponsibilitySection;
