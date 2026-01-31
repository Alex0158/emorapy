import { Typography, message } from 'antd';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import JudgmentViewer from '@/components/business/JudgmentViewer';
import { t } from '@/utils/i18n';

const { Title } = Typography;

type Props = {
  content: string;
};

const JudgmentSection = ({ content }: Props) => {
  return (
    <AnimatedWrapper animation="fade" delay={400} trigger="intersection">
      <section id="judgment-section" className="judgment-section" aria-labelledby="judgment-title">
        <div className="container">
          <Title level={3} id="judgment-title" className="section-title" style={{ marginBottom: 16 }}>
            {t('judgment.title')}
          </Title>
          <JudgmentViewer
            content={content}
            title={t('judgment.title')}
            onShare={() => {
              message.info('分享功能開發中');
            }}
            onFavorite={() => {
              message.info('收藏功能需要註冊後使用');
            }}
            showActions={true}
          />
        </div>
      </section>
    </AnimatedWrapper>
  );
};

export default JudgmentSection;
