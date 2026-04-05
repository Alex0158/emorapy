/**
 * 和好方案承諾工作台
 */

import { useEffect, useRef, useState } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  HeartOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import {
  getPlanById,
  invitePartner,
  pausePlan,
  respondPlan,
  selectPlan,
} from '@/services/api/reconciliation';
import { confirmExecution, resumeTrack } from '@/services/api/execution';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { getErrorMessage } from '@/utils/apiError';
import { safeParsePlanContent } from '@/utils/planContent';
import { t } from '@/utils/i18n';
import './Detail.less';

const { Title, Paragraph, Text } = Typography;

const commitmentLabelMap: Record<string, string> = {
  not_viewed: '還沒開始',
  viewed: '已看過',
  deferred: '需要一點時間',
  committed: '願意一起試',
  declined: '暫時不想加入',
  paused: '暫停中',
};

type PlanDetail = Awaited<ReturnType<typeof getPlanById>>;

const ReconciliationDetail = () => {
  const { judgmentId, id } = useParams<{ judgmentId: string; id: string }>();
  const navigate = useNavigate();
  const mountedRef = useMountedRef();
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchLockRef = useRef(false);
  const staleRef = useRef(false);

  useEffect(() => {
    staleRef.current = false;
    if (id) {
      void fetchPlan();
    }
    return () => {
      staleRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchPlan = async () => {
    if (!id || fetchLockRef.current) return;
    fetchLockRef.current = true;
    setLoading(true);
    setLoadError(null);
    try {
      const planDetail = await getPlanById(id);
      if (staleRef.current) return;
      setPlan(planDetail);
      if (
        planDetail.viewer_role === 'invitee'
        && planDetail.commitment?.current_user.commitment_status === 'not_viewed'
      ) {
        await respondPlan(id, 'viewed');
        if (!staleRef.current) {
          const refreshed = await getPlanById(id);
          if (!staleRef.current) setPlan(refreshed);
        }
      }
    } catch (error: unknown) {
      if (staleRef.current) return;
      const msg = getErrorMessage(error, 'message.getPlanDetailFail');
      setLoadError(msg);
      setPlan(null);
    } finally {
      fetchLockRef.current = false;
      if (!staleRef.current) setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!id) return;
    setSelecting(true);
    try {
      await selectPlan(id);
      if (!mountedRef.current) return;
      message.success('已記下你的承諾。你可以先自己開始，也可以邀請對方一起試。');
      await fetchPlan();
    } catch (error: unknown) {
      if (mountedRef.current) message.error(getErrorMessage(error, 'message.selectPlanFail'));
    } finally {
      if (mountedRef.current) setSelecting(false);
    }
  };

  const handleInvite = async () => {
    if (!id) return;
    setInviting(true);
    try {
      await invitePartner(id);
      if (!mountedRef.current) return;
      message.success('已送出低壓邀請，讓對方知道你想一起試試看。');
      await fetchPlan();
    } catch (error: unknown) {
      if (mountedRef.current) message.error(getErrorMessage(error, 'message.operationFail'));
    } finally {
      if (mountedRef.current) setInviting(false);
    }
  };

  const handleStart = async () => {
    if (!id) return;
    setStarting(true);
    try {
      await confirmExecution(id);
      if (!mountedRef.current) return;
      message.success('今天的第一步已準備好了。');
      navigate(`/execution/${id}/checkin`);
    } catch (error: unknown) {
      if (mountedRef.current) message.error(getErrorMessage(error, 'message.startExecutionFail'));
    } finally {
      if (mountedRef.current) setStarting(false);
    }
  };

  const handlePause = async () => {
    if (!id) return;
    setPausing(true);
    try {
      await pausePlan(id);
      if (!mountedRef.current) return;
      message.success('已暫停這一輪，不代表之前的努力白費。');
      await fetchPlan();
    } catch (error: unknown) {
      if (mountedRef.current) message.error(getErrorMessage(error, 'message.operationFail'));
    } finally {
      if (mountedRef.current) setPausing(false);
    }
  };

  const handleRespond = async (
    action: 'committed' | 'deferred' | 'declined',
    options?: { reason?: 'need_time' | 'needs_space' | 'unsure' | 'too_much_pressure'; remind_in_hours?: number },
  ) => {
    if (!id) return;
    setSelecting(true);
    try {
      if (options) {
        await respondPlan(id, action, options);
      } else {
        await respondPlan(id, action);
      }
      if (!mountedRef.current) return;
      message.success(
        action === 'committed'
          ? '已記下你願意一起試的決定。'
          : action === 'deferred'
            ? '已記下你需要一點時間。'
            : '已記下你暫時不加入的選擇。',
      );
      await fetchPlan();
    } catch (error: unknown) {
      if (mountedRef.current) message.error(getErrorMessage(error, 'message.operationFail'));
    } finally {
      if (mountedRef.current) setSelecting(false);
    }
  };

  const handleResume = async () => {
    if (!plan?.commitment?.track_id) return;
    setResuming(true);
    try {
      const result = await resumeTrack(plan.commitment.track_id);
      if (!mountedRef.current) return;
      message.success('已恢復這一輪修復旅程。');
      navigate(`/execution/${result.plan_id}/checkin`);
    } catch (error: unknown) {
      if (mountedRef.current) message.error(getErrorMessage(error, 'message.operationFail'));
    } finally {
      if (mountedRef.current) setResuming(false);
    }
  };

  if (loading) {
    return (
      <div className="reconciliation-detail-page">
        <Spin size="large" description={t('common.loading')} />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="reconciliation-detail-page">
        <Alert
          title={t('message.planNotFound')}
          description={loadError ?? undefined}
          type="error"
          showIcon
          action={(
            <Space>
              <Button size="small" onClick={() => fetchPlan()}>{t('common.retry')}</Button>
              <Button size="small" type="primary" onClick={() => judgmentId && navigate(`/reconciliation/${judgmentId}`)}>
                返回方案頁
              </Button>
            </Space>
          )}
        />
      </div>
    );
  }

  const parsed = plan.content || safeParsePlanContent(plan.plan_content);
  const currentStatus = plan.commitment?.current_user.commitment_status || 'not_viewed';
  const partnerStatus = plan.commitment?.partner?.commitment_status || 'not_viewed';
  const dualCommitted = plan.commitment?.is_dual_committed || false;
  const viewerRole = plan.viewer_role || 'solo';
  const trackStatus = plan.commitment?.track_status || 'draft';
  const journeyContext = plan.journey_context;

  return (
    <ProtectedRoute>
      <SEO title={t('reconDetail.pageTitle')} description={parsed.description.substring(0, 100)} />
      <div className="reconciliation-detail-page" role="main" aria-label={t('reconDetail.pageLabel')}>
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header" aria-labelledby="plan-title">
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} aria-label={t('reconDetail.backAria')}>
              {t('reconDetail.back')}
            </Button>
          </div>
        </AnimatedWrapper>

        <div className="max-w-5xl mx-auto px-6 pb-24">
          <AnimatedWrapper animation="slide" direction="up" delay={200}>
            <Card className="glassmorphism-2 border-none shadow-sm rounded-3xl mb-8">
              <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                <Space wrap>
                  <Tag color="blue">{plan.intent}</Tag>
                  <Tag color={plan.commitment?.recommended_mode === 'co' ? 'purple' : 'gold'}>
                    {plan.commitment?.recommended_mode === 'co' ? '雙方共修模式' : '單人先行模式'}
                  </Tag>
                </Space>
                <div>
                  <Title level={2} id="plan-title" className="font-heading mb-2">{parsed.title}</Title>
                  <Paragraph className="text-base text-gray-700 mb-0">{parsed.description}</Paragraph>
                </div>
                <Descriptions column={{ xs: 1, md: 2 }} bordered>
                  <Descriptions.Item label="為什麼是這個方案">{plan.fit_reason || parsed.fit_reason}</Descriptions.Item>
                  <Descriptions.Item label="預計時長">{plan.estimated_duration != null ? `${plan.estimated_duration} 天` : '未定'}</Descriptions.Item>
                  <Descriptions.Item label="先不要用在什麼情況">
                    {(plan.do_not_use_when || parsed.do_not_use_when).join('、') || '目前沒有額外限制'}
                  </Descriptions.Item>
                  <Descriptions.Item label="卡住時怎麼降難度">{plan.fallback_step || parsed.fallback_step}</Descriptions.Item>
                </Descriptions>
              </Space>
            </Card>
          </AnimatedWrapper>

          <AnimatedWrapper animation="slide" direction="up" delay={260}>
            <Row gutter={[24, 24]}>
              <Col xs={24} md={12}>
                <Card className="rounded-3xl shadow-sm h-full">
                  <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                    <Title level={4} className="mb-0">對你來說第一步是什麼</Title>
                    <Paragraph className="mb-0">{plan.first_step || parsed.first_step || parsed.steps[0]}</Paragraph>
                    <Text type="secondary">如果覺得太難：{plan.fallback_step || parsed.fallback_step}</Text>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card className="rounded-3xl shadow-sm h-full">
                  <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                    <Title level={4} className="mb-0">如果對方還沒準備好</Title>
                    <Paragraph className="mb-0">
                      你仍然可以先從一個低壓步驟開始，先把氣氛和安全感慢慢拉回來，而不是逼彼此一次談完。
                    </Paragraph>
                    <Text type="secondary">不舒服時怎麼暫停：{plan.pause_rule || parsed.pause_rule}</Text>
                  </Space>
                </Card>
              </Col>
            </Row>
          </AnimatedWrapper>

          <AnimatedWrapper animation="slide" direction="up" delay={320}>
            <Card className="rounded-3xl shadow-sm mt-8">
              <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                <Title level={4} className="mb-0">共同承諾狀態</Title>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Card size="small" variant="borderless" className="bg-gray-50 rounded-2xl">
                      <Space orientation="vertical">
                        <Text strong>你目前的狀態</Text>
                        <Tag color={currentStatus === 'committed' ? 'success' : currentStatus === 'paused' ? 'warning' : 'default'}>
                          {commitmentLabelMap[currentStatus] || currentStatus}
                        </Tag>
                      </Space>
                    </Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card size="small" variant="borderless" className="bg-gray-50 rounded-2xl">
                      <Space orientation="vertical">
                        <Text strong>對方目前的狀態</Text>
                        <Tag color={partnerStatus === 'committed' ? 'success' : partnerStatus === 'viewed' ? 'processing' : 'default'}>
                          {commitmentLabelMap[partnerStatus] || partnerStatus}
                        </Tag>
                      </Space>
                    </Card>
                  </Col>
                </Row>
                <Alert
                  type={dualCommitted ? 'success' : 'info'}
                  showIcon
                  title={journeyContext?.title || (dualCommitted ? '你們正在一起修復' : '現在也可以由你先開始')}
                  description={journeyContext?.body || (dualCommitted
                    ? '雙方都已經願意試，接下來會以共修模式推進。'
                    : '如果對方還沒準備好，你也可以先從一個低壓的小步驟開始。')}
                />
                {plan.track_history_summary?.has_superseded_versions ? (
                  <Alert
                    type="warning"
                    showIcon
                    title="這個方向曾調整過版本"
                    description={`這一輪之前已做過 ${plan.track_history_summary.superseded_versions_count} 次版本調整，現在看到的是最新版本。`}
                  />
                ) : null}
                <Space wrap>
                  {viewerRole === 'invitee' && currentStatus !== 'committed' && currentStatus !== 'declined' && (
                    <>
                      <Button type="primary" icon={<CheckCircleOutlined />} loading={selecting} onClick={() => handleRespond('committed')}>
                        我願意一起試
                      </Button>
                      <Button loading={selecting} onClick={() => handleRespond('deferred', { reason: 'need_time', remind_in_hours: 72 })}>
                        我需要一點時間
                      </Button>
                      <Button loading={selecting} onClick={() => handleRespond('declined', { reason: 'needs_space' })}>
                        暫時先不要
                      </Button>
                    </>
                  )}
                  {viewerRole !== 'invitee' && currentStatus !== 'committed' && currentStatus !== 'declined' && (
                    <Button type="primary" icon={<CheckCircleOutlined />} loading={selecting} onClick={handleCommit}>
                      我願意先開始
                    </Button>
                  )}
                  {currentStatus === 'committed' && trackStatus !== 'replanning' && trackStatus !== 'paused' && (
                    <Button type="primary" icon={<PlayCircleOutlined />} loading={starting} onClick={handleStart}>
                      從今天開始
                    </Button>
                  )}
                  {currentStatus === 'committed' && !dualCommitted && viewerRole !== 'invitee' && plan.invite_context?.can_invite && (
                    <Button icon={<SendOutlined />} loading={inviting} onClick={handleInvite}>
                      邀請對方一起試
                    </Button>
                  )}
                  {trackStatus === 'replanning' && (
                    <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate(`/execution/${id}/replan`)}>
                      重新調整這一輪
                    </Button>
                  )}
                  {(trackStatus === 'paused' || currentStatus === 'paused') && plan.commitment?.track_id && (
                    <Button type="primary" icon={<PlayCircleOutlined />} loading={resuming} onClick={handleResume}>
                      恢復這一輪
                    </Button>
                  )}
                  {currentStatus === 'committed' && trackStatus !== 'paused' && (
                    <Button icon={<PauseCircleOutlined />} loading={pausing} onClick={handlePause}>
                      先暫停，不等於放棄
                    </Button>
                  )}
                  <Button icon={<HeartOutlined />} onClick={() => judgmentId && navigate(`/reconciliation/${judgmentId}`)}>
                    重新看看其他方向
                  </Button>
                </Space>
              </Space>
            </Card>
          </AnimatedWrapper>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default ReconciliationDetail;
