/**
 * 判決詳情頁面（優化版）
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { logger } from '@/utils/logger';
import {
  Card,
  Button,
  Typography,
  Space,
  Rate,
  Modal,
  message,
  Spin,
  Alert,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  HeartOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { getJudgment, acceptJudgment } from '@/services/api/judgment';
import { generatePlans } from '@/services/api/reconciliation';
import { psychProfileApi } from '@/services/api/psychProfile';
import { useInterviewTrigger } from '@/hooks/useInterviewTrigger';
import type { Judgment } from '@/types/judgment';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import BearJudge from '@/components/business/BearJudge';
import JudgmentViewer from '@/components/business/JudgmentViewer';
import ResponsibilityRatio from '@/components/business/ResponsibilityRatio';
import ConsentModal from '@/components/business/Interview/ConsentModal';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { t } from '@/utils/i18n';
import './Detail.less';

const { Title, Text } = Typography;

const POST_JUDGMENT_RICHNESS_THRESHOLD = 0.5;

const JudgmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [rating, setRating] = useState(0);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const [showPostJudgmentCard, setShowPostJudgmentCard] = useState(false);
  const dismissedPostJudgmentRef = useRef(false);
  const {
    triggerInterview: handlePostJudgmentChat,
    consentOpen,
    setConsentOpen,
    setProfileConsent,
    handleConsent,
    consentLoading,
  } = useInterviewTrigger('post_judgment');

  const staleRef = useRef(false);
  useEffect(() => {
    staleRef.current = false;
    setJudgment(null);
    setRating(0);
    if (id) {
      fetchJudgment();
    }
    return () => { staleRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅在 id 變化時拉取
  }, [id]);

  useEffect(() => {
    if (!judgment) return;
    if (judgment.user1_acceptance === false) {
      setShowPostJudgmentCard(false);
      return;
    }
    if (dismissedPostJudgmentRef.current) return;

    let cancelled = false;
    psychProfileApi.getProfile()
      .then((res) => {
        if (cancelled) return;
        const profile = res.data?.data;
        if (!profile) return;
        setProfileConsent(!!profile.consent_given);
        const richness = profile.richness_score ?? 0;
        if (richness < POST_JUDGMENT_RICHNESS_THRESHOLD) {
          setShowPostJudgmentCard(true);
        }
      })
      .catch((e: unknown) => { logger.warn('Failed to fetch profile for post-judgment card', e); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setProfileConsent is stable from hook
  }, [judgment, setProfileConsent]);

  const fetchJudgment = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const judgmentData = await getJudgment(id);
      if (staleRef.current) return;
      setJudgment(judgmentData);
      if (judgmentData.user1_rating) {
        setRating(judgmentData.user1_rating);
      }
    } catch (error: unknown) {
      if (staleRef.current) return;
      const msg = (error as { message?: string })?.message || t('message.getJudgmentDetailFail');
      message.error(msg);
    } finally {
      if (!staleRef.current) setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!id || accepting) return;
    setAccepting(true);
    try {
      await acceptJudgment(id, { accepted: true, rating: rating || undefined });
      message.success(t('message.acceptJudgmentSuccess'));
      setShowAcceptModal(false);
      fetchJudgment(); // 刷新數據
    } catch (error: unknown) {
      const msg = (error as { message?: string })?.message || t('message.operationFail');
      message.error(msg);
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!id || accepting) return;
    setAccepting(true);
    try {
      await acceptJudgment(id, { accepted: false });
      message.success(t('message.rejectJudgmentSuccess'));
      setShowRejectModal(false);
      fetchJudgment();
    } catch (error: unknown) {
      const msg = (error as { message?: string })?.message || t('message.operationFail');
      message.error(msg);
    } finally {
      setAccepting(false);
    }
  };

  const handleGeneratePlans = async () => {
    if (!id) return;
    setGenerating(true);
    try {
      await generatePlans(id);
      message.success(t('message.generatePlansSuccess'));
      navigate(`/reconciliation/${id}`);
    } catch (error: unknown) {
      const msg = (error as { message?: string })?.message || t('message.generatePlansFail');
      message.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const responsibilityRatio = useMemo(
    () =>
      judgment
        ? (judgment.responsibility_ratio ?? {
            plaintiff: judgment.plaintiff_ratio,
            defendant: judgment.defendant_ratio,
          })
        : { plaintiff: 0, defendant: 0 },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 已用 judgment 的欄位作為 deps
    [judgment?.plaintiff_ratio, judgment?.defendant_ratio, judgment?.responsibility_ratio]
  );

  if (loading) {
    return (
      <div className="judgment-detail-page">
        <Spin size="large" description={t('common.loading')} />
      </div>
    );
  }

  if (!judgment) {
    return (
      <div className="judgment-detail-page">
        <Alert
          title={t('message.judgmentNotFound')}
          type="error"
          action={
            <Space>
              <Button size="small" onClick={() => navigate(-1)}>
                {t('judgmentDetail.back')}
              </Button>
              <Button size="small" type="primary" onClick={() => id && fetchJudgment()}>
                {t('common.retry')}
              </Button>
            </Space>
          }
        />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <SEO
        title={t('judgmentDetail.pageTitle')}
        description={t('judgmentDetail.description')}
      />
      <div className="judgment-detail-page" role="main" aria-label={t('judgmentDetail.pageLabel')}>
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header" role="navigation" aria-label={t('judgmentDetail.actionsLabel')}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
              aria-label={t('judgmentDetail.backAria')}
            >
              {t('judgmentDetail.back')}
            </Button>
          </div>
        </AnimatedWrapper>

        <AnimatedWrapper animation="fade" delay={200}>
          <div className="judgment-header" aria-labelledby="judgment-title">
            <BearJudge size="large" animated />
            <Title level={2} id="judgment-title">
              {t('result.title')}
            </Title>
            <Text type="secondary">{t('result.subtitle')}</Text>
          </div>
        </AnimatedWrapper>

        <AnimatedWrapper animation="scale" delay={300} trigger="intersection">
          <Card className="responsibility-card" role="article" aria-labelledby="responsibility-title">
            <Title level={3} id="responsibility-title">
              {t('responsibility.title')}
            </Title>
            <ResponsibilityRatio
              ratio={responsibilityRatio}
              showLabels={true}
              size="large"
            />
          </Card>
        </AnimatedWrapper>

        <AnimatedWrapper animation="fade" delay={400} trigger="intersection">
          <Card className="judgment-content-card" role="article" aria-labelledby="judgment-content-title">
            <JudgmentViewer
              content={judgment.judgment_content}
              title={t('judgmentDetail.docTitle')}
              showActions={true}
            />
          </Card>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={500} trigger="intersection">
          <Card className="action-card" role="article" aria-labelledby="feedback-title">
            <Title level={4} id="feedback-title">
              {t('judgmentDetail.feedbackTitle')}
            </Title>
            <Space orientation="vertical" size="large" style={{ width: '100%' }}>
              <div role="group" aria-label={t('judgmentDetail.ratingAria')}>
                <Text>{t('judgmentDetail.ratingLabel')}</Text>
                <Rate
                  value={rating}
                  onChange={setRating}
                  style={{ marginLeft: 8 }}
                  aria-label={t('judgmentDetail.ratingAria')}
                />
              </div>

              <Space role="group" aria-label={t('judgmentDetail.actionsGroupLabel')}>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => setShowAcceptModal(true)}
                  disabled={judgment.user1_acceptance !== undefined}
                  aria-label={t('judgmentDetail.acceptAria')}
                >
                  {t('judgmentDetail.accept')}
                </Button>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setShowRejectModal(true)}
                  disabled={judgment.user1_acceptance !== undefined}
                  aria-label={t('judgmentDetail.rejectAria')}
                >
                  {t('judgmentDetail.reject')}
                </Button>
                <Button
                  type="default"
                  icon={<HeartOutlined />}
                  onClick={handleGeneratePlans}
                  loading={generating}
                  aria-label={t('judgmentDetail.generatePlansAria')}
                >
                  {t('judgmentDetail.generatePlans')}
                </Button>
              </Space>

            {judgment.user1_acceptance !== undefined && (
              <Alert
                title={judgment.user1_acceptance ? t('judgmentDetail.acceptedAlert') : t('judgmentDetail.rejectedAlert')}
                type={judgment.user1_acceptance ? 'success' : 'warning'}
                showIcon
                role="status"
                aria-live="polite"
              />
            )}
          </Space>
          </Card>
        </AnimatedWrapper>

        <Modal
          title={t('judgmentDetail.acceptModalTitle')}
          open={showAcceptModal}
          onOk={handleAccept}
          onCancel={() => setShowAcceptModal(false)}
          confirmLoading={accepting}
        >
          <p>{t('judgmentDetail.acceptModalConfirm')}</p>
          {rating > 0 && <p>{t('judgmentDetail.acceptModalRating').replace('{rating}', String(rating))}</p>}
        </Modal>

        <Modal
          title={t('judgmentDetail.rejectModalTitle')}
          open={showRejectModal}
          onOk={handleReject}
          onCancel={() => setShowRejectModal(false)}
          confirmLoading={accepting}
        >
          <p>{t('judgmentDetail.rejectModalConfirm')}</p>
        </Modal>

        {showPostJudgmentCard && (
          <AnimatedWrapper animation="slide" direction="up" delay={600}>
            <Card className="post-judgment-trigger-card" style={{ marginTop: 16 }}>
            <Space orientation="vertical" size="middle" style={{ width: '100%', textAlign: 'center' }}>
                <HeartOutlined style={{ fontSize: 32, color: '#eb2f96' }} />
                <Title level={4} style={{ margin: 0 }}>{t('trigger.postJudgmentTitle')}</Title>
                <Text type="secondary">{t('trigger.postJudgmentDesc')}</Text>
                <Space>
                  <Button type="primary" onClick={handlePostJudgmentChat}>
                    {t('trigger.postJudgmentOk')}
                  </Button>
                  <Button onClick={() => { dismissedPostJudgmentRef.current = true; setShowPostJudgmentCard(false); }}>
                    {t('trigger.postJudgmentSkip')}
                  </Button>
                </Space>
              </Space>
            </Card>
          </AnimatedWrapper>
        )}

        <ConsentModal
          open={consentOpen}
          onConsent={handleConsent}
          onCancel={() => setConsentOpen(false)}
          loading={consentLoading}
        />
      </div>
    </ProtectedRoute>
  );
};

export default JudgmentDetail;
