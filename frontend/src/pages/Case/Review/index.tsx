/**
 * 審理中頁面
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Typography,
  Space,
  Spin,
  Progress,
  message,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { getCase } from '@/services/api/case';
import { getJudgmentByCaseId } from '@/services/api/judgment';
import type { Case } from '@/types/case';
import type { Judgment } from '@/types/judgment';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import BearJudge from '@/components/business/BearJudge';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { usePolling } from '@/hooks/usePolling';
import { POLLING_INTERVAL } from '@/utils/constants';
import { t } from '@/utils/i18n';
import { logger } from '@/utils/logger';
import './Review.less';

const { Title, Text, Paragraph } = Typography;

const CaseReview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [case_, setCase_] = useState<Case | null>(null);
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅在 id 變化時拉取
  }, [id]);

  const fetchCase = async () => {
    setLoading(true);
    try {
      const caseData = await getCase(id!);
      setCase_(caseData);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('common.getCaseFail');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchJudgment = async (): Promise<boolean> => {
    if (!id) return false;
    try {
      const judgmentData = await getJudgmentByCaseId(id);
      if (judgmentData) {
        setJudgment(judgmentData);
        return true; // 停止輪詢
      }
      return false; // 繼續輪詢
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'JUDGMENT_NOT_FOUND' || err.code === 'HTTP_404') {
        return false; // 繼續輪詢
      }
      logger.error('Failed to fetch judgment', error);
      return false;
    }
  };

  const { startPolling, stopPolling, isPolling } = usePolling(fetchJudgment, POLLING_INTERVAL);

  useEffect(() => {
    if (case_ && (case_.status === 'submitted' || case_.status === 'in_progress')) {
      startPolling();
    }
    return () => stopPolling();
  }, [case_, startPolling, stopPolling]);

  useEffect(() => {
    if (judgment) {
      stopPolling();
      // 判決生成完成，可以跳轉到結果頁
    }
  }, [judgment, stopPolling]);

  if (loading) {
    return (
      <div className="case-review-page">
        <Spin size="large" tip={t('common.loading')} />
      </div>
    );
  }

  if (!case_) {
    return (
      <div className="case-review-page">
        <Alert message={t('common.caseNotFound')} type="error" />
      </div>
    );
  }

  if (judgment) {
    return (
      <div className="case-review-page">
        <Card>
          <Alert
            message={t('review.judgmentReady')}
            description={t('review.judgmentReadyDesc')}
            type="success"
            showIcon
            action={
              <Button type="primary" onClick={() => navigate(`/judgment/${judgment.id}`)}>
                {t('review.viewJudgment')}
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <SEO
        title={t('review.title')}
        description={t('review.description')}
      />
      <div className="case-review-page" role="main" aria-label={t('review.pageLabel')}>
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="review-header" aria-labelledby="review-title">
            <BearJudge size="large" animated />
            <Title level={2} id="review-title">
              {t('review.aiReviewing')}
            </Title>
            <Paragraph type="secondary">
              {t('review.analyzingHint')}
            </Paragraph>
          </div>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
          <Card>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div className="progress-section">
              <Progress
                percent={isPolling ? 75 : 100}
                status={isPolling ? 'active' : 'success'}
                strokeColor={{
                  '0%': '#ff8c42',
                  '100%': '#5b9bd5',
                }}
              />
              <Text type="secondary" style={{ display: 'block', marginTop: 16, textAlign: 'center' }}>
                {isPolling ? t('review.aiAnalyzing') : t('review.done')}
              </Text>
            </div>

            <Alert
              message={t('review.etaTitle')}
              description={t('review.etaDesc')}
              type="info"
              showIcon
            />

            <div className="case-info">
              <Text strong>{t('review.caseTitle')}：</Text>
              <Text>{case_.title}</Text>
            </div>
          </Space>
          </Card>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={300} trigger="intersection">
          <div className="action-section">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/case/${id}`)}>
              返回案件詳情
            </Button>
          </div>
        </AnimatedWrapper>
      </div>
    </ProtectedRoute>
  );
};

export default CaseReview;

