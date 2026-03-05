import { Typography } from 'antd';
import MediatorAvatar from '@/components/business/MediatorAvatar';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { t } from '@/utils/i18n';

const { Title, Text } = Typography;

const ResultHeader = () => {
  return (
    <AnimatedWrapper animation="fade" delay={100}>
      <section className="result-header" aria-labelledby="result-title">
        <MediatorAvatar size="large" animated />
        <Title level={1} id="result-title" className="result-title">
          {t('result.title')}
        </Title>
        <Text className="result-subtitle">{t('result.subtitle')}</Text>
      </section>
    </AnimatedWrapper>
  );
};

export default ResultHeader;
