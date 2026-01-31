import { Card, Typography } from 'antd';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import ResponsibilityRatio from '@/components/business/ResponsibilityRatio';
import { t } from '@/utils/i18n';

const { Title } = Typography;

type Ratio = {
  plaintiff: number;
  defendant: number;
};

type Props = {
  ratio: Ratio;
  showLabels?: boolean;
  size?: 'small' | 'medium' | 'large';
};

const ResponsibilitySection = ({ ratio, showLabels = true, size = 'large' }: Props) => {
  return (
    <AnimatedWrapper animation="scale" delay={300} trigger="intersection">
      <section className="responsibility-section" aria-labelledby="responsibility-title">
        <div className="container">
          <Card className="responsibility-card">
            <Title level={3} id="responsibility-title" className="section-title">
              {t('responsibility.title')}
            </Title>
            <ResponsibilityRatio ratio={ratio} showLabels={showLabels} size={size} />
          </Card>
        </div>
      </section>
    </AnimatedWrapper>
  );
};

export default ResponsibilitySection;
