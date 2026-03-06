/**
 * 我的故事 — 心理畫像專頁
 * 顯示所有領域敘事、洞察、豐富度及訪談歷史
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Card,
  Space,
  Tag,
  Button,
  Collapse,
  Progress,
  Empty,
  Spin,
  Modal,
  message,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  MessageOutlined,
  DeleteOutlined,
  HistoryOutlined,
  BulbOutlined,
  BookOutlined,
} from '@ant-design/icons';
import RichnessRing from '@/components/business/Interview/RichnessRing';
import { usePsychProfileStore } from '@/store/psychProfileStore';
import { useInterviewStore } from '@/store/interviewStore';
import { getDomainLabel } from '@/types/interview';
import type { PsychDomain, ProfileInsight, FeedbackHistoryItem, FeedbackCard } from '@/types/interview';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { getLocale, t } from '@/utils/i18n';
import './index.less';

const { Title, Text, Paragraph } = Typography;

const ALL_DOMAINS: PsychDomain[] = [
  'attachment',
  'family_origin',
  'life_events',
  'relationship_history',
  'belief_values',
  'cultural_background',
  'personality',
  'education_cognition',
];

const MyStory: React.FC = () => {
  const navigate = useNavigate();
  const {
    profile,
    feedbackHistory,
    loading,
    error: storeError,
    fetchProfile,
    fetchFeedbackHistory,
    deleteAllData,
  } = usePsychProfileStore();
  const { startSession, checkResume, retryFailed } = useInterviewStore();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failedSessionId, setFailedSessionId] = useState<string | null>(null);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const locale = getLocale();

  const getInsightTypeLabel = (insightType: string) => {
    const translated = t(`psychProfile.insightType.${insightType}`);
    return translated === `psychProfile.insightType.${insightType}` ? insightType : translated;
  };

  useEffect(() => {
    let cancelled = false;
    fetchProfile();
    fetchFeedbackHistory();
    checkResume().then(data => {
      if (cancelled) return;
      if (data.has_failed && data.failed_session_id) {
        setFailedSessionId(data.failed_session_id);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleStartChat = async () => {
    try {
      const resumeData = await checkResume();
      if (resumeData.has_pending && resumeData.session_id) {
        navigate(`/interview/${resumeData.session_id}`);
        return;
      }
      const session = await startSession('organic');
      navigate(`/interview/${session.id}`);
    } catch {
      message.error(t('interview.startFail'));
    }
  };

  const handleRetryFailed = async () => {
    if (!failedSessionId) return;
    setRetryingFailed(true);
    try {
      await retryFailed(failedSessionId);
      message.info(t('psychProfile.retryProcessing'));
      setFailedSessionId(null);
    } catch {
      message.error(t('interview.retryFail'));
    } finally {
      setRetryingFailed(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAllData();
      message.success(t('psychProfile.deleteSuccess'));
      setDeleteModalOpen(false);
      navigate('/profile/index');
    } catch {
      message.error(t('psychProfile.deleteFail'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="my-story-page__loading">
        <Spin size="large" />
        <Text type="secondary">{t('common.loading')}</Text>
      </div>
    );
  }

  if (!loading && !profile && storeError) {
    return (
      <div className="my-story-page">
        <Alert
          title={t('common.loadFailed')}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={() => fetchProfile()}>
              {t('common.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  if (!profile?.consent_given) {
    return (
      <div className="my-story-page">
        <Empty
          description={t('psychProfile.noStoryYet')}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => navigate('/profile/index')}>
            {t('psychProfile.goStartStory')}
          </Button>
        </Empty>
      </div>
    );
  }

  const latestNarratives = profile.narratives?.filter((n) => n.is_latest && n.completeness > 0) || [];
  const activeInsights = profile.insights?.filter((i) => i.is_active) || [];
  const exploredDomains = latestNarratives.map((n) => n.domain);
  const unexploredDomains = ALL_DOMAINS.filter((d) => !exploredDomains.includes(d));

  const insightsByDomain = activeInsights.reduce<Record<string, ProfileInsight[]>>((acc, i) => {
    if (!acc[i.domain]) acc[i.domain] = [];
    acc[i.domain].push(i);
    return acc;
  }, {});

  return (
    <>
      <SEO
        title={t('psychProfile.myStoryTitle')}
        description={t('psychProfile.myStoryDesc')}
      />
      <div className="my-story-page" role="main">
        <div className="adaptive-hero-section mb-8 bg-gradient-to-br from-background to-gray-50 rounded-b-[40px] shadow-sm p-8">
          <div className="max-w-4xl mx-auto">
            {failedSessionId && (
              <Alert
                type="warning"
                showIcon
                closable
                onClose={() => setFailedSessionId(null)}
                title={t('psychProfile.failedSessionTitle')}
                description={t('psychProfile.failedSessionDesc')}
                action={
                  <Button size="small" loading={retryingFailed} onClick={handleRetryFailed}>
                    {t('psychProfile.retryProcessing')}
                  </Button>
                }
                style={{ marginBottom: 16 }}
                className="rounded-2xl"
              />
            )}
            <AnimatedWrapper animation="fade" delay={100}>
              <div className="my-story-page__header flex items-center gap-4 mb-4">
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate('/profile/index')}
                  className="font-semibold text-gray-600 hover:text-primary"
                />
                <Title level={2} style={{ margin: 0, flex: 1 }} className="font-heading font-bold text-3xl">{t('psychProfile.myStoryTitle')}</Title>
              </div>
            </AnimatedWrapper>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 pb-24">
          {/* 豐富度概覽 */}
          <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
            <Card className="my-story-page__overview glassmorphism-2 border-none shadow-sm rounded-3xl mb-8">
              <div className="my-story-page__overview-content flex flex-col md:flex-row items-center gap-8">
                <RichnessRing score={profile.richness_score || 0} size={120} />
                <div className="my-story-page__overview-info flex-1">
                  <Text strong className="text-lg block mb-4">{t('psychProfile.exploredDomains')}</Text>
                  <div className="my-story-page__domain-tags flex flex-wrap gap-2 mb-6">
                    {exploredDomains.map((d) => (
                      <Tag key={d} color="blue" className="rounded-full px-3 py-1 text-sm border-blue-200 bg-blue-50 text-blue-600">{getDomainLabel(d as PsychDomain)}</Tag>
                    ))}
                    {unexploredDomains.map((d) => (
                      <Tag key={d} className="rounded-full px-3 py-1 text-sm text-gray-400 bg-gray-50 border-gray-200">{getDomainLabel(d as PsychDomain)}</Tag>
                    ))}
                  </div>
                  <Button
                    type="primary"
                    size="large"
                    shape="round"
                    icon={<MessageOutlined />}
                    onClick={handleStartChat}
                    className="shadow-md hover:shadow-lg"
                  >
                    {t('psychProfile.continueChat')}
                  </Button>
                </div>
              </div>
            </Card>
          </AnimatedWrapper>

          {/* 按領域展示敘事和洞察 */}
          <AnimatedWrapper animation="slide" direction="up" delay={300} trigger="intersection">
            <Card title={<span className="font-heading text-xl"><BookOutlined className="mr-2" /> {t('psychProfile.domainDetails')}</span>} className="glassmorphism-2 border-none shadow-sm rounded-3xl mb-8">
              {latestNarratives.length === 0 ? (
                <Empty
                  description={t('psychProfile.noDomainData')}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <Collapse
                  expandIconPlacement="end"
                  ghost
                  className="bg-white/50 rounded-2xl"
                  items={latestNarratives.map((narrative) => ({
                    key: narrative.domain,
                    label: (
                      <Space size="middle" className="w-full">
                        <Tag color="blue" className="rounded-full px-3 py-1 text-sm border-blue-200 bg-blue-50 text-blue-600">{getDomainLabel(narrative.domain as PsychDomain)}</Tag>
                        <Progress
                          percent={Math.round(narrative.completeness * 100)}
                          size="small"
                          style={{ width: 100 }}
                          showInfo={false}
                          strokeColor="#84A59D"
                        />
                        <Text type="secondary" className="font-medium">{Math.round(narrative.completeness * 100)}%</Text>
                      </Space>
                    ),
                    children: (
                      <Space orientation="vertical" size="large" style={{ width: '100%' }} className="pt-2 pb-4">
                        {narrative.ai_summary && (
                          <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                            <Text type="secondary" className="block mb-2 font-semibold">{t('psychProfile.aiSummary')}：</Text>
                            <Paragraph className="text-gray-700 leading-relaxed m-0">{narrative.ai_summary}</Paragraph>
                          </div>
                        )}

                        {insightsByDomain[narrative.domain]?.length > 0 && (
                          <div>
                            <Text type="secondary" className="block mb-4 font-semibold"><BulbOutlined className="mr-1" /> {t('psychProfile.insightsForDomain')}：</Text>
                            <div className="my-story-page__insights space-y-3">
                              {insightsByDomain[narrative.domain].map((insight) => (
                                <div key={insight.id} className="my-story-page__insight-item bg-white p-4 rounded-2xl shadow-sm border border-gray-50">
                                  <div className="my-story-page__insight-header flex items-center gap-3 mb-2">
                                    <Tag className="rounded-full m-0">{getInsightTypeLabel(insight.insight_type)}</Tag>
                                    <Text strong className="text-gray-900">{insight.key}</Text>
                                    <Progress
                                      percent={Math.round(insight.confidence * 100)}
                                      size="small"
                                      style={{ width: 60 }}
                                      showInfo={false}
                                      strokeColor="#E27D60"
                                      className="m-0"
                                    />
                                  </div>
                                  <Text className="block text-gray-700 mb-2">{insight.value}</Text>
                                  {insight.evidence && (
                                    <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                                      <Text type="secondary" italic className="text-sm text-blue-700/80">「{insight.evidence}」</Text>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </Space>
                    ),
                  }))}
                />
              )}
            </Card>
          </AnimatedWrapper>

          {/* 訪談歷史 */}
          {feedbackHistory.length > 0 && (
            <AnimatedWrapper animation="slide" direction="up" delay={400}>
              <Card
                title={<span className="font-heading text-xl"><HistoryOutlined className="mr-2" /> {t('psychProfile.interviewHistory')}</span>}
                className="glassmorphism-2 border-none shadow-sm rounded-3xl mb-8"
              >
                <div className="space-y-4">
                {feedbackHistory.map((item: FeedbackHistoryItem) => {
                  let card: FeedbackCard | null = null;
                  try {
                    card = item.feedback_card ? JSON.parse(item.feedback_card) : null;
                  } catch { /* ignore */ }

                  return (
                    <div key={item.session_id} className="my-story-page__history-item bg-white/50 p-4 rounded-2xl border border-gray-50">
                      <div className="my-story-page__history-header flex justify-between items-start mb-3">
                        <Text type="secondary" className="font-medium">
                          {new Date(item.created_at).toLocaleDateString(locale)}
                        </Text>
                        <Space className="flex-wrap justify-end">
                          {item.domains_touched.map((d) => (
                            <Tag key={d} color="blue" className="rounded-full m-0 border-blue-200 bg-blue-50 text-blue-600">{getDomainLabel(d as PsychDomain)}</Tag>
                          ))}
                        </Space>
                      </div>
                      {card?.summary && (
                        <Paragraph type="secondary" className="text-gray-600 leading-relaxed m-0">{card.summary}</Paragraph>
                      )}
                    </div>
                  );
                })}
                </div>
              </Card>
            </AnimatedWrapper>
          )}

          {/* 管理我的資料 */}
          <AnimatedWrapper animation="slide" direction="up" delay={500} trigger="intersection">
            <Card className="my-story-page__manage glassmorphism-2 border-none shadow-sm rounded-3xl bg-red-50/30">
              <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                <Title level={5} className="font-heading text-red-800 m-0">{t('psychProfile.manageData')}</Title>
                <Paragraph type="secondary" className="text-red-600/80 m-0">
                  {t('psychProfile.manageDataDesc')}
                </Paragraph>
                <Button
                  danger
                  shape="round"
                  icon={<DeleteOutlined />}
                  onClick={() => setDeleteModalOpen(true)}
                  className="mt-2"
                >
                  {t('psychProfile.deleteAllData')}
                </Button>
              </Space>
            </Card>
          </AnimatedWrapper>

          <Modal
            title={t('psychProfile.deleteConfirmTitle')}
            open={deleteModalOpen}
            onOk={handleDelete}
            onCancel={() => setDeleteModalOpen(false)}
            okText={t('psychProfile.confirmDelete')}
            cancelText={t('common.cancel')}
            okButtonProps={{ danger: true, loading: deleting, shape: 'round' }}
            cancelButtonProps={{ shape: 'round' }}
            centered
            className="rounded-3xl overflow-hidden"
          >
            <Paragraph className="text-lg">{t('psychProfile.deleteConfirmDesc')}</Paragraph>
            <Paragraph className="text-red-500 font-medium">{t('psychProfile.deleteWarning')}</Paragraph>
          </Modal>
        </div>
      </div>
    </>
  );
};

export default MyStory;
