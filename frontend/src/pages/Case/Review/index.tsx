/**
 * 審理中頁面
 */

import { useState, useEffect, useRef } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
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
  ReloadOutlined,
} from '@ant-design/icons';
import { getCase } from '@/services/api/case';
import { getJudgmentByCaseId, generateJudgment } from '@/services/api/judgment';
import type { Case } from '@/types/case';
import type { Judgment } from '@/types/judgment';
import MediatorAvatar from '@/components/business/MediatorAvatar';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { usePolling } from '@/hooks/usePolling';
import { POLLING_INTERVAL } from '@/utils/constants';
import { getErrorMessage } from '@/utils/apiError';
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
  const [retrying, setRetrying] = useState(false);
  const [loadErrorTitle, setLoadErrorTitle] = useState<string | null>(null);
  const [loadErrorDescription, setLoadErrorDescription] = useState<string | null>(null);
  const mountedRef = useMountedRef();
  const retryLockRef = useRef(false);
  const fetchLockRef = useRef(false);

  const staleRef = useRef(false);
  useEffect(() => {
    staleRef.current = false;
    setCase_(null);
    setJudgment(null);
    if (id) {
      fetchCase();
    }
    return () => { staleRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅在 id 變化時拉取
  }, [id]);

  const fetchCase = async () => {
    if (!id || fetchLockRef.current) return;
    fetchLockRef.current = true;
    setLoading(true);
    try {
      const caseData = await getCase(id);
      if (staleRef.current) return;
      setLoadErrorTitle(null);
      setLoadErrorDescription(null);
      setCase_(caseData);
    } catch (error: unknown) {
      if (staleRef.current) return;
      const err = error as { code?: string; message?: string };
      if (err?.code === 'FORBIDDEN' || err?.code === 'HTTP_403') {
        const errorMessage = getErrorMessage(error, 'message.noPermissionViewCase');
        setLoadErrorTitle(t('message.noPermissionViewCase'));
        setLoadErrorDescription(errorMessage === t('message.noPermissionViewCase') ? null : errorMessage);
        message.error(errorMessage);
        navigate('/case/list', { replace: true });
      } else if (err?.code === 'NOT_FOUND' || err?.code === 'HTTP_404') {
        const errorMessage = t('common.caseNotFound');
        setLoadErrorTitle(errorMessage);
        setLoadErrorDescription(null);
        message.error(errorMessage);
      } else {
        const errorMessage = getErrorMessage(error, 'common.getCaseFail');
        setLoadErrorTitle(t('common.getCaseFail'));
        setLoadErrorDescription(errorMessage === t('common.getCaseFail') ? null : errorMessage);
        message.error(errorMessage);
      }
    } finally {
      fetchLockRef.current = false;
      if (!staleRef.current) setLoading(false);
    }
  };

  const fetchJudgment = async (): Promise<boolean> => {
    if (!id) return false;
    try {
      const judgmentData = await getJudgmentByCaseId(id);
      if (staleRef.current) return false;
      if (judgmentData) {
        setJudgment(judgmentData);
        return true;
      }
      return false;
    } catch (error: unknown) {
      if (staleRef.current) return false;
      const err = error as { code?: string };
      if (err?.code === 'JUDGMENT_NOT_FOUND' || err?.code === 'HTTP_404') {
        return false;
      }
      logger.error('Failed to fetch judgment', error);
      return false;
    }
  };

  const { startPolling, stopPolling, isPolling } = usePolling(
    fetchJudgment,
    POLLING_INTERVAL,
    (data) => data === true
  );

  useEffect(() => {
    if (!case_) return;
    if (case_.status === 'completed' || case_.status === 'judgment_failed') {
      fetchJudgment();
    } else if (case_.status === 'submitted' || case_.status === 'in_progress') {
      startPolling();
    } else if (case_.status === 'draft') {
      message.warning(t('review.caseNotSubmitted'));
      navigate(`/case/${id}`, { replace: true });
    } else if (case_.status === 'cancelled') {
      message.warning(t('review.caseCancelled'));
      navigate(`/case/list`, { replace: true });
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchJudgment 不進 deps
  }, [case_, startPolling, stopPolling]);

  useEffect(() => {
    if (judgment) {
      stopPolling();
    }
  }, [judgment, stopPolling]);

  const handleRetryJudgment = async () => {
    if (!id || retrying || retryLockRef.current) return;
    retryLockRef.current = true;
    setRetrying(true);
    try {
      const newJudgment = await generateJudgment(id);
      if (!mountedRef.current) return;
      setJudgment(newJudgment);
      message.success(t('review.retrySuccess'));
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      const err = error as { code?: string; message?: string };
      if (err?.code === 'JUDGMENT_EXISTS') {
        try {
          const judgmentData = await getJudgmentByCaseId(id);
          if (!mountedRef.current) return;
          if (judgmentData) {
            setJudgment(judgmentData);
          } else {
            message.error(t('review.retryFail'));
            if (id) fetchCase();
          }
        } catch (fetchErr: unknown) {
          if (!mountedRef.current) return;
          const msg = getErrorMessage(fetchErr, 'review.retryFail');
          message.error(msg);
          if (id) fetchCase();
        }
      } else {
        message.error(getErrorMessage(error, 'review.retryFail'));
        if (id) fetchCase();
      }
    } finally {
      retryLockRef.current = false;
      if (mountedRef.current) setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="case-review-page">
        <Spin size="large" description={t('common.loading')} />
      </div>
    );
  }

  if (!case_) {
    return (
      <div className="case-review-page">
        <Alert
          title={loadErrorTitle || t('common.caseNotFound')}
          description={loadErrorDescription || undefined}
          type="error"
          action={
            <Space>
              <Button size="small" onClick={() => navigate('/case/list')}>
                {t('caseDetail.backList')}
              </Button>
              <Button size="small" type="primary" onClick={() => id && fetchCase()}>
                {t('common.retry')}
              </Button>
            </Space>
          }
        />
      </div>
    );
  }

  if (judgment) {
    return (
      <div className="case-review-page">
        <Card>
          <Alert
            title={t('review.judgmentReady')}
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

  if (case_.status === 'judgment_failed') {
    return (
      <div className="case-review-page">
        <Card>
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            <Alert
              title={t('review.judgmentFailed')}
              description={case_.judgment_failure_reason || t('review.judgmentFailedDesc')}
              type="error"
              showIcon
            />
            <Space>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                loading={retrying}
                onClick={handleRetryJudgment}
              >
                {t('review.retryJudgment')}
              </Button>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/case/${id}`)}>
                {t('review.backToCase')}
              </Button>
            </Space>
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={t('review.title')}
        description={t('review.description')}
      />
      <div className="case-review-page" role="main" aria-label={t('review.pageLabel')}>
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="review-header" aria-labelledby="review-title">
            <MediatorAvatar size="large" animated />
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
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
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
              title={t('review.etaTitle')}
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
              {t('review.backToCase')}
            </Button>
          </div>
        </AnimatedWrapper>
      </div>
    </>
  );
};

export default CaseReview;
