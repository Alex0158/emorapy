import { Collapse, Typography } from 'antd';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { t } from '@/utils/i18n';

const { Panel } = Collapse;
const { Text } = Typography;

type Props = {
  summary?: string | null;
};

const SummarySection = ({ summary }: Props) => {
  return (
    <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
      <section className="summary-section" aria-labelledby="summary-title">
        <div className="container">
          <Collapse defaultActiveKey={['summary']}>
            <Panel header={<span id="summary-title">{t('summary.title')}</span>} key="summary">
              <div className="summary-content">
                {summary && (
                  <div className="summary-item" role="article">
                    <QuestionCircleOutlined className="summary-icon" aria-hidden="true" />
                    <Text className="summary-text">{summary}</Text>
                  </div>
                )}
              </div>
            </Panel>
          </Collapse>
        </div>
      </section>
    </AnimatedWrapper>
  );
};

export default SummarySection;
