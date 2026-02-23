import React from 'react';
import { Card, Typography, Tag, Space, Button } from 'antd';
import { SmileOutlined, RightOutlined, BookOutlined } from '@ant-design/icons';
import RichnessRing from '../RichnessRing';
import type { FeedbackCard as FeedbackCardType, PsychDomain } from '@/types/interview';
import { getDomainLabel } from '@/types/interview';
import { t } from '@/utils/i18n';
import './index.less';

const { Title, Paragraph, Text } = Typography;

interface FeedbackCardProps {
  feedback: FeedbackCardType;
  onViewProfile?: () => void;
  onBackToCase?: () => void;
  onBackToJudgment?: () => void;
  onGoHome?: () => void;
  trigger?: string;
}

const FeedbackCardComponent: React.FC<FeedbackCardProps> = ({
  feedback,
  onViewProfile,
  onBackToCase,
  onBackToJudgment,
  onGoHome,
  trigger,
}) => {
  const getPrimaryAction = () => {
    switch (trigger) {
      case 'post_judgment':
        return { text: t('feedback.backToJudgment'), onClick: onBackToJudgment ?? onGoHome };
      case 'pre_case':
        return { text: t('feedback.continueSubmit'), onClick: onBackToCase ?? onGoHome };
      case 'onboarding':
      case 'organic':
      default:
        return { text: t('feedback.backToHome'), onClick: onGoHome };
    }
  };

  const primaryAction = getPrimaryAction();

  return (
    <Card className="feedback-card" bordered={false}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div className="feedback-card__header">
          <SmileOutlined style={{ fontSize: 28, color: '#52c41a' }} />
          <Title level={4} style={{ margin: 0 }}>{t('interview.result.doneTitle')}</Title>
        </div>

        <Paragraph className="feedback-card__summary">{feedback.summary}</Paragraph>

        <div>
          <Text type="secondary">{t('psychProfile.exploredDomains')}：</Text>
          <div className="feedback-card__domains">
            {(feedback.domains_explored ?? []).map((d) => (
              <Tag key={d} color="blue">{getDomainLabel(d as PsychDomain)}</Tag>
            ))}
          </div>
        </div>

        {(feedback.domains_unexplored ?? []).length > 0 && (
          <div>
            <Text type="secondary">{t('psychProfile.unexploredDomains')}：</Text>
            <div className="feedback-card__domains">
              {(feedback.domains_unexplored ?? []).map((d) => (
                <Tag key={d} color="default">{getDomainLabel(d as PsychDomain)}</Tag>
              ))}
            </div>
          </div>
        )}

        {(feedback.key_insights ?? []).length > 0 && (
          <div>
            <Text type="secondary">{t('psychProfile.keyInsights')}：</Text>
            <ul className="feedback-card__insights">
              {(feedback.key_insights ?? []).map((insight, i) => (
                <li key={i}>{insight}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="feedback-card__richness">
          <RichnessRing score={feedback.richness_score} size={64} />
        </div>

        <Paragraph type="secondary" italic className="feedback-card__encouragement">
          {feedback.encouragement}
        </Paragraph>

        {feedback.continuation_hint && (
          <Paragraph className="feedback-card__continuation-hint">
            {feedback.continuation_hint}
          </Paragraph>
        )}

        <Space>
          {primaryAction.onClick && (
            <Button type="primary" onClick={primaryAction.onClick} icon={<RightOutlined />}>
              {primaryAction.text}
            </Button>
          )}
          {onViewProfile && (
            <Button icon={<BookOutlined />} onClick={onViewProfile}>
              {t('feedback.viewMyStory')}
            </Button>
          )}
        </Space>
      </Space>
    </Card>
  );
};

export default FeedbackCardComponent;
