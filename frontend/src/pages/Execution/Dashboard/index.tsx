/**
 * 修復進展看板
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { RightOutlined } from '@ant-design/icons';
import { getAllExecutionStatuses, resumeTrack, type ExecutionStatus } from '@/services/api/execution';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import {
  getDifficultyText,
  getPlanTypeTagColor,
  getPlanTypeText,
} from '@/utils/statusTags';
import './Dashboard.less';

const { Title, Text, Paragraph } = Typography;

const journeyStatusLabelMap: Record<string, string> = {
  draft: '還在準備中',
  partner_invited: '已邀請對方',
  solo_active: '由你先開始',
  co_active: '你們正在一起修復',
  replanning: '需要重新調整',
  paused: '暫停中',
  completed: '這一輪已完成',
  closed: '已結束',
};

const sectionOrder = [
  'draft',
  'partner_invited',
  'active',
  'replanning',
  'paused',
  'completed',
] as const;

const sectionMeta: Record<(typeof sectionOrder)[number], { title: string; matcher: (status: string) => boolean }> = {
  draft: {
    title: '等你決定',
    matcher: (status) => status === 'draft',
  },
  partner_invited: {
    title: '等對方 / 等時間',
    matcher: (status) => status === 'partner_waiting' || status === 'partner_invited',
  },
  active: {
    title: '今天的一小步',
    matcher: (status) => status === 'active' || status === 'solo_active' || status === 'co_active',
  },
  replanning: {
    title: '需要重新調整',
    matcher: (status) => status === 'replanning',
  },
  paused: {
    title: '暫停中',
    matcher: (status) => status === 'paused',
  },
  completed: {
    title: '已完成',
    matcher: (status) => status === 'completed' || status === 'closed',
  },
};

const primaryCtaLabelMap: Record<string, string> = {
  commit_plan: '回到承諾工作台',
  view_invitation_status: '查看邀請進度',
  continue_today_step: '去看今天的一小步',
  replan_track: '重新調整這一輪',
  resume_track: '恢復這一輪',
  review_completed_journey: '回看這一輪',
  review_history: '回看這一輪',
};

const ExecutionDashboard = () => {
  const navigate = useNavigate();
  const [executions, setExecutions] = useState<ExecutionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchLockRef = useRef(false);
  const staleRef = useRef(false);

  const fetchExecutions = async () => {
    if (fetchLockRef.current) return;
    fetchLockRef.current = true;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getAllExecutionStatuses();
      if (staleRef.current) return;
      setExecutions(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      if (staleRef.current) return;
      const msg = getErrorMessage(error, 'message.getExecutionStatusFail');
      setLoadError(msg);
      setExecutions([]);
      message.error(msg);
    } finally {
      fetchLockRef.current = false;
      if (!staleRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    staleRef.current = false;
    void fetchExecutions();
    return () => {
      staleRef.current = true;
    };
  }, []);

  const sections = useMemo(() => (
    sectionOrder.map((key) => ({
      key,
      title: sectionMeta[key].title,
      items: executions.filter((item) => sectionMeta[key].matcher(item.presentation_bucket || item.journey_status)),
    })).filter((section) => section.items.length > 0)
  ), [executions]);
  const hasVisibleJourneys = sections.length > 0;

  const handlePrimaryAction = async (item: ExecutionStatus) => {
    if (item.journey_context?.primary_cta.path) {
      navigate(item.journey_context.primary_cta.path);
      return;
    }
    if (item.primary_cta === 'replan_track') {
      navigate(`/execution/${item.plan_id}/replan`);
      return;
    }
    if (item.primary_cta === 'resume_track' && item.track_id) {
      try {
        const resumed = await resumeTrack(item.track_id);
        navigate(`/execution/${resumed.plan_id}/checkin`);
      } catch (error: unknown) {
        message.error(getErrorMessage(error, 'message.operationFail'));
      }
      return;
    }
    if (item.primary_cta === 'view_invitation_status' || item.primary_cta === 'commit_plan' || item.primary_cta === 'review_history' || item.primary_cta === 'review_completed_journey') {
      if (item.judgment_id) {
        navigate(`/reconciliation/${item.judgment_id}/${item.plan_id}`);
      } else {
        navigate(item.plan_id ? `/execution/${item.plan_id}/checkin` : '/execution/dashboard');
      }
      return;
    }
    navigate(`/execution/${item.plan_id}/checkin`);
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="execution-dashboard-page">
          <Spin size="large" description={t('common.loading')} style={{ padding: 48, display: 'block', textAlign: 'center' }} />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SEO title={t('execDashboard.title')} description={t('execDashboard.description')} />
      <div className="execution-dashboard-page" role="main" aria-label={t('execDashboard.pageLabel')}>
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header">
            <Title level={2}>{t('execDashboard.heading')}</Title>
            <Text type="secondary">{t('execDashboard.subtitle')}</Text>
          </div>
        </AnimatedWrapper>

        {loadError ? (
          <AnimatedWrapper animation="slide" direction="up" delay={200}>
            <Alert
              type="error"
              showIcon
              title={loadError}
              action={(
                <Space>
                  <Button size="small" onClick={() => fetchExecutions()}>{t('common.retry')}</Button>
                  <Button size="small" onClick={() => navigate(-1)}>{t('common.back')}</Button>
                </Space>
              )}
            />
          </AnimatedWrapper>
        ) : !hasVisibleJourneys ? (
          <AnimatedWrapper animation="slide" direction="up" delay={200}>
            <Card>
              <Empty description={t('execDashboard.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE}>
                <Text type="secondary">{t('execDashboard.emptyHint')}</Text>
              </Empty>
            </Card>
          </AnimatedWrapper>
        ) : (
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            {sections.map((section, index) => (
              <AnimatedWrapper animation="slide" direction="up" delay={220 + index * 40} key={section.key}>
                <div>
                  <Title level={4}>{section.title}</Title>
                  <Row gutter={[16, 16]}>
                    {section.items.map((item) => (
                      <Col xs={24} md={12} lg={8} key={item.plan_id}>
                        <Card
                          className="execution-card"
                          hoverable
                          actions={[
                            <Button
                              type="link"
                              key="step"
                              icon={<RightOutlined />}
                              onClick={() => void handlePrimaryAction(item)}
                            >
                              {item.journey_context?.primary_cta.label || primaryCtaLabelMap[item.primary_cta || 'continue_today_step'] || '查看這一輪'}
                            </Button>,
                          ]}
                        >
                          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                            <div className="execution-card-header">
                              <Text strong ellipsis style={{ maxWidth: '100%' }}>
                                {item.journey_context?.title || item.plan_summary?.title || t('execDashboard.planFallbackTitle').replace('{id}', item.plan_id.slice(0, 8))}
                              </Text>
                              <Tag color={item.relationship_mode === 'co' ? 'purple' : 'gold'}>
                                {item.relationship_mode === 'co' ? '共修' : '單人先行'}
                              </Tag>
                            </div>
                            <Space size="small" wrap>
                              {item.plan_summary ? (
                                <>
                                  <Tag color={getPlanTypeTagColor(item.plan_summary.plan_type)}>{getPlanTypeText(item.plan_summary.plan_type)}</Tag>
                                  <Tag>{getDifficultyText(item.plan_summary.difficulty_level)}</Tag>
                                </>
                              ) : null}
                              <Tag>{journeyStatusLabelMap[item.journey_status] || item.journey_status}</Tag>
                            </Space>
                            {item.journey_context?.body ? (
                              <Paragraph ellipsis={{ rows: 2 }} className="mb-0 text-gray-600">
                                {item.journey_context.body}
                              </Paragraph>
                            ) : item.plan_summary?.fit_reason ? (
                              <Paragraph ellipsis={{ rows: 2 }} className="mb-0 text-gray-600">
                                {item.plan_summary.fit_reason}
                              </Paragraph>
                            ) : null}
                            <Progress percent={item.progress} status={item.journey_status === 'replanning' ? 'exception' : 'active'} />
                            {item.pulse_summary ? (
                              <Text type="secondary">
                                距離感：{item.pulse_summary.closeness} / 壓力：{item.pulse_summary.stress}
                                {item.pulse_summary.needs_replan ? ' / 建議重新調整' : ''}
                              </Text>
                            ) : null}
                            {item.status_reason ? (
                              <Text type="secondary">目前狀態：{item.status_reason}</Text>
                            ) : null}
                          </Space>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </div>
              </AnimatedWrapper>
            ))}
          </Space>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default ExecutionDashboard;
