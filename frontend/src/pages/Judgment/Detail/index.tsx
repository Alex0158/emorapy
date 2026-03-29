/**
 * 判決詳情頁面（優化版）
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
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
import MediatorAvatar from '@/components/business/MediatorAvatar';
import JudgmentViewer from '@/components/business/JudgmentViewer';
import ResponsibilityRatio from '@/components/business/ResponsibilityRatio';
import ConsentModal from '@/components/business/Interview/ConsentModal';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import './Detail.less';

const { Title, Text } = Typography;

const POST_JUDGMENT_RICHNESS_THRESHOLD = 0.5;

const JudgmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [rating, setRating] = useState(0);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const [showPostJudgmentCard, setShowPostJudgmentCard] = useState(false);
  const dismissedPostJudgmentRef = useRef(false);
  const generatingLockRef = useRef(false);
  const fetchLockRef = useRef(false);
  const acceptLockRef = useRef(false);
  const {
    triggerInterview: handlePostJudgmentChat,
    consentOpen,
    setConsentOpen,
    setProfileConsent,
    handleConsent,
    consentLoading,
  } = useInterviewTrigger('post_judgment');

  const mountedRef = useMountedRef();
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
    if (!id || fetchLockRef.current) return;
    fetchLockRef.current = true;
    setLoading(true);
    setLoadError(null);
    try {
      const judgmentData = await getJudgment(id);
      if (staleRef.current) return;
      setJudgment(judgmentData);
      if (judgmentData.user1_rating) {
        setRating(judgmentData.user1_rating);
      }
    } catch (error: unknown) {
      if (staleRef.current) return;
      const msg = getErrorMessage(error, 'message.getJudgmentDetailFail');
      message.error(msg);
      setLoadError(msg);
    } finally {
      fetchLockRef.current = false;
      if (!staleRef.current) setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!id || accepting || acceptLockRef.current) return;
    acceptLockRef.current = true;
    setAccepting(true);
    try {
      await acceptJudgment(id, { accepted: true, rating: rating || undefined });
      if (!mountedRef.current) return;
      message.success(t('message.acceptJudgmentSuccess'));
      setShowAcceptModal(false);
      setJudgment((prev) => (prev ? { ...prev, user1_acceptance: true as const } : null)); // 樂觀更新，避免 fetch 失敗時按鈕仍可點
      fetchJudgment(); // 刷新數據
    } catch (error: unknown) {
      message.error(getErrorMessage(error, 'message.operationFail'));
    } finally {
      acceptLockRef.current = false;
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!id || accepting || acceptLockRef.current) return;
    acceptLockRef.current = true;
    setAccepting(true);
    try {
      await acceptJudgment(id, { accepted: false });
      if (!mountedRef.current) return;
      message.success(t('message.rejectJudgmentSuccess'));
      setShowRejectModal(false);
      setJudgment((prev) => (prev ? { ...prev, user1_acceptance: false as const } : null)); // 樂觀更新，避免 fetch 失敗時按鈕仍可點
      fetchJudgment();
    } catch (error: unknown) {
      message.error(getErrorMessage(error, 'message.operationFail'));
    } finally {
      acceptLockRef.current = false;
      setAccepting(false);
    }
  };

  const handleGeneratePlans = async () => {
    if (!id || generatingLockRef.current) return;
    generatingLockRef.current = true;
    setGenerating(true);
    try {
      await generatePlans(id);
      if (!mountedRef.current) return;
      message.success(t('message.generatePlansSuccess'));
      navigate(`/reconciliation/${id}`);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, 'message.generatePlansFail'));
    } finally {
      generatingLockRef.current = false;
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
          description={loadError ?? undefined}
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
    <>
      <SEO
        title={t('judgmentDetail.pageTitle')}
        description={t('judgmentDetail.description')}
      />
      <div className="judgment-detail-page" role="main" aria-label={t('judgmentDetail.pageLabel')}>
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header" role="navigation" aria-label={t('judgmentDetail.actionsLabel')}>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
              className="font-semibold text-gray-600 hover:text-primary"
              aria-label={t('judgmentDetail.backAria')}
            >
              {t('judgmentDetail.back')}
            </Button>
          </div>
        </AnimatedWrapper>

        <AnimatedWrapper animation="fade" delay={200}>
          <div className="judgment-header text-center mb-12" aria-labelledby="judgment-title">
            <MediatorAvatar size="large" animated />
            <Title level={2} id="judgment-title" className="font-heading font-bold mt-6 mb-2">
              {t('result.title')}
            </Title>
            <Text type="secondary" className="text-lg">{t('result.subtitle')}</Text>
          </div>
        </AnimatedWrapper>

        <div className="max-w-4xl mx-auto px-6 pb-24">
          <AnimatedWrapper animation="scale" delay={300} trigger="intersection">
            <Card className="responsibility-card glassmorphism-2 border-none shadow-sm rounded-3xl mb-8" role="article" aria-labelledby="responsibility-title">
              <Title level={3} id="responsibility-title" className="font-heading mb-6">
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
            <div className="judgment-content-wrapper mb-8">
              <JudgmentViewer
                content={judgment.judgment_content ?? ''}
                title={t('judgmentDetail.docTitle')}
                showActions={true}
              />
            </div>
          </AnimatedWrapper>

          <AnimatedWrapper animation="slide" direction="up" delay={500} trigger="intersection">
            <Card className="action-card glassmorphism-2 border-none shadow-sm rounded-3xl" role="article" aria-labelledby="feedback-title">
              <Title level={4} id="feedback-title" className="font-heading mb-6">
                {t('judgmentDetail.feedbackTitle')}
              </Title>
              <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                <div role="group" aria-label={t('judgmentDetail.ratingAria')} className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl">
                  <Text className="text-lg">{t('judgmentDetail.ratingLabel')}</Text>
                  <Rate
                    value={rating}
                    onChange={setRating}
                    className="text-primary text-2xl"
                    aria-label={t('judgmentDetail.ratingAria')}
                  />
                </div>

                <div className="flex flex-wrap gap-4 mt-4" role="group" aria-label={t('judgmentDetail.actionsGroupLabel')}>
                  <Button
                    type="primary"
                    size="large"
                    shape="round"
                    icon={<CheckCircleOutlined />}
                    onClick={() => setShowAcceptModal(true)}
                    disabled={judgment.user1_acceptance !== undefined}
                    aria-label={t('judgmentDetail.acceptAria')}
                    className="shadow-md hover:shadow-lg"
                  >
                    {t('judgmentDetail.accept')}
                  </Button>
                  <Button
                    danger
                    size="large"
                    shape="round"
                    icon={<CloseCircleOutlined />}
                    onClick={() => setShowRejectModal(true)}
                    disabled={judgment.user1_acceptance !== undefined}
                    aria-label={t('judgmentDetail.rejectAria')}
                  >
                    {t('judgmentDetail.reject')}
                  </Button>
                  <Button
                    type="default"
                    size="large"
                    shape="round"
                    icon={<HeartOutlined />}
                    onClick={handleGeneratePlans}
                    loading={generating}
                    aria-label={t('judgmentDetail.generatePlansAria')}
                    className="ml-auto"
                  >
                    {t('judgmentDetail.generatePlans')}
                  </Button>
                </div>

              {judgment.user1_acceptance !== undefined && (
                <Alert
                  title={judgment.user1_acceptance ? t('judgmentDetail.acceptedAlert') : t('judgmentDetail.rejectedAlert')}
                  type={judgment.user1_acceptance ? 'success' : 'warning'}
                  showIcon
                  role="status"
                  aria-live="polite"
                  className="rounded-2xl mt-4"
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
            centered
            className="rounded-3xl overflow-hidden"
          >
            <p className="text-lg">{t('judgmentDetail.acceptModalConfirm')}</p>
            {rating > 0 && <p className="text-primary font-semibold">{t('judgmentDetail.acceptModalRating').replace('{rating}', String(rating))}</p>}
          </Modal>

          <Modal
            title={t('judgmentDetail.rejectModalTitle')}
            open={showRejectModal}
            onOk={handleReject}
            onCancel={() => setShowRejectModal(false)}
            confirmLoading={accepting}
            centered
            className="rounded-3xl overflow-hidden"
          >
            <p className="text-lg">{t('judgmentDetail.rejectModalConfirm')}</p>
          </Modal>

          {showPostJudgmentCard && (
            <AnimatedWrapper animation="slide" direction="up" delay={600}>
              <Card className="post-judgment-trigger-card mt-8 rounded-3xl border-primary/20 bg-primary/5">
                <Space orientation="vertical" size="middle" style={{ width: '100%', textAlign: 'center' }}>
                  <HeartOutlined style={{ fontSize: 48, color: '#E27D60' }} />
                  <Title level={4} style={{ margin: 0 }} className="font-heading">{t('trigger.postJudgmentTitle')}</Title>
                  <Text type="secondary" className="text-lg">{t('trigger.postJudgmentDesc')}</Text>
                  <Space className="mt-4">
                    <Button type="primary" size="large" shape="round" onClick={handlePostJudgmentChat}>
                      {t('trigger.postJudgmentOk')}
                    </Button>
                    <Button size="large" shape="round" onClick={() => { dismissedPostJudgmentRef.current = true; setShowPostJudgmentCard(false); }}>
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
      </div>
    </>
  );
};

export default JudgmentDetail;
