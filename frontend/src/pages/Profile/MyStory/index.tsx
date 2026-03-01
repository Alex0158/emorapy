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
  Divider,
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
import { t } from '@/utils/i18n';
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
          />
        )}
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="my-story-page__header">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/profile/index')}
            />
            <Title level={2} style={{ margin: 0, flex: 1 }}>{t('psychProfile.myStoryTitle')}</Title>
          </div>
        </AnimatedWrapper>

        {/* 豐富度概覽 */}
        <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
          <Card className="my-story-page__overview">
            <div className="my-story-page__overview-content">
              <RichnessRing score={profile.richness_score || 0} size={100} />
              <div className="my-story-page__overview-info">
                <Text strong>{t('psychProfile.exploredDomains')}</Text>
                <div className="my-story-page__domain-tags">
                  {exploredDomains.map((d) => (
                    <Tag key={d} color="blue">{getDomainLabel(d as PsychDomain)}</Tag>
                  ))}
                  {unexploredDomains.map((d) => (
                    <Tag key={d}>{getDomainLabel(d as PsychDomain)}</Tag>
                  ))}
                </div>
                <Button
                  type="primary"
                  icon={<MessageOutlined />}
                  onClick={handleStartChat}
                  style={{ marginTop: 12 }}
                >
                  {t('psychProfile.continueChat')}
                </Button>
              </div>
            </div>
          </Card>
        </AnimatedWrapper>

        {/* 按領域展示敘事和洞察 */}
        <AnimatedWrapper animation="slide" direction="up" delay={300} trigger="intersection">
          <Card title={<><BookOutlined /> {t('psychProfile.domainDetails')}</>} style={{ marginTop: 16 }}>
            {latestNarratives.length === 0 ? (
              <Empty
                description={t('psychProfile.noDomainData')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Collapse
                expandIconPlacement="end"
                items={latestNarratives.map((narrative) => ({
                  key: narrative.domain,
                  label: (
                    <Space>
                      <Tag color="blue">{getDomainLabel(narrative.domain as PsychDomain)}</Tag>
                      <Progress
                        percent={Math.round(narrative.completeness * 100)}
                        size="small"
                        style={{ width: 100 }}
                        showInfo={false}
                      />
                      <Text type="secondary">{Math.round(narrative.completeness * 100)}%</Text>
                    </Space>
                  ),
                  children: (
                    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                      {narrative.ai_summary && (
                        <div>
                          <Text type="secondary">{t('psychProfile.aiSummary')}：</Text>
                          <Paragraph>{narrative.ai_summary}</Paragraph>
                        </div>
                      )}

                      {insightsByDomain[narrative.domain]?.length > 0 && (
                        <div>
                          <Text type="secondary"><BulbOutlined /> {t('psychProfile.insightsForDomain')}：</Text>
                          <div className="my-story-page__insights">
                            {insightsByDomain[narrative.domain].map((insight) => (
                              <div key={insight.id} className="my-story-page__insight-item">
                                <div className="my-story-page__insight-header">
                                  <Tag>{insight.insight_type}</Tag>
                                  <Text strong>{insight.key}</Text>
                                  <Progress
                                    percent={Math.round(insight.confidence * 100)}
                                    size="small"
                                    style={{ width: 60 }}
                                    showInfo={false}
                                  />
                                </div>
                                <Text>{insight.value}</Text>
                                {insight.evidence && (
                                  <Text type="secondary" italic>「{insight.evidence}」</Text>
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
              title={<><HistoryOutlined /> {t('psychProfile.interviewHistory')}</>}
              style={{ marginTop: 16 }}
            >
              {feedbackHistory.map((item: FeedbackHistoryItem) => {
                let card: FeedbackCard | null = null;
                try {
                  card = item.feedback_card ? JSON.parse(item.feedback_card) : null;
                } catch { /* ignore */ }

                return (
                  <div key={item.session_id} className="my-story-page__history-item">
                    <div className="my-story-page__history-header">
                      <Text type="secondary">
                        {new Date(item.created_at).toLocaleDateString('zh-TW')}
                      </Text>
                      <Space>
                        {item.domains_touched.map((d) => (
                          <Tag key={d} color="blue" style={{ margin: 0 }}>{getDomainLabel(d as PsychDomain)}</Tag>
                        ))}
                      </Space>
                    </div>
                    {card?.summary && (
                      <Paragraph type="secondary">{card.summary}</Paragraph>
                    )}
                    <Divider style={{ margin: '8px 0' }} />
                  </div>
                );
              })}
            </Card>
          </AnimatedWrapper>
        )}

        {/* 管理我的資料 */}
        <AnimatedWrapper animation="slide" direction="up" delay={500} trigger="intersection">
          <Card style={{ marginTop: 16 }} className="my-story-page__manage">
            <Space orientation="vertical" size="small" style={{ width: '100%' }}>
              <Title level={5}>{t('psychProfile.manageData')}</Title>
              <Paragraph type="secondary">
                {t('psychProfile.manageDataDesc')}
              </Paragraph>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => setDeleteModalOpen(true)}
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
          okButtonProps={{ danger: true, loading: deleting }}
        >
          <Paragraph>{t('psychProfile.deleteConfirmDesc')}</Paragraph>
          <Paragraph type="danger">{t('psychProfile.deleteWarning')}</Paragraph>
        </Modal>
      </div>
    </>
  );
};

export default MyStory;
