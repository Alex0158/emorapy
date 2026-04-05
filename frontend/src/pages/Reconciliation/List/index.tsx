/**
 * 和好方案旅程頁面
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  Switch,
  message,
} from 'antd';
import {
  CompassOutlined,
  HeartOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import {
  generatePlans,
  getPlans,
  selectPlan,
  type PlanPreferences,
  type ReconciliationIntent,
  type ReconciliationPlan,
  type JourneyEntry,
} from '@/services/api/reconciliation';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import MediatorAvatar from '@/components/business/MediatorAvatar';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import { safeParsePlanContent } from '@/utils/planContent';
import {
  getDifficultyTagColor,
  getDifficultyText,
  getPlanTypeTagColor,
  getPlanTypeText,
} from '@/utils/statusTags';
import './List.less';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

const intentMeta: Record<ReconciliationIntent, { title: string; subtitle: string }> = {
  repair: {
    title: '我想試著修復',
    subtitle: '先選一個最適合你們現在狀態的靠近方式，而不是把所有事一次解決。',
  },
  cool_down: {
    title: '我想先降溫，不急著決定',
    subtitle: '先穩住情緒和距離感，再決定要不要往下一步走。',
  },
  graceful_exit: {
    title: '我想體面地結束 / 拉開距離',
    subtitle: '有時候好好收尾，也是一種對彼此的尊重和照顧。',
  },
  safety_support: {
    title: '我需要安全支持',
    subtitle: '先讓自己回到更安全、更穩的狀態，比任何關係決定都重要。',
  },
};

const defaultPreferences: PlanPreferences = {
  pressure_level: 'low',
  pace: 'today',
  style: ['action'],
  invite_partner: true,
};

const normalizePlans = (payload: unknown): ReconciliationPlan[] => {
  if (Array.isArray(payload)) {
    return payload as ReconciliationPlan[];
  }

  if (payload && typeof payload === 'object' && 'plans' in payload) {
    const plans = (payload as { plans?: unknown }).plans;
    return Array.isArray(plans) ? (plans as ReconciliationPlan[]) : [];
  }

  return [];
};

const normalizeRecommendedPlanId = (payload: unknown): string | null => {
  if (payload && typeof payload === 'object' && 'recommended_plan_id' in payload) {
    const value = (payload as { recommended_plan_id?: unknown }).recommended_plan_id;
    return typeof value === 'string' ? value : null;
  }

  return null;
};

const normalizeJourneyEntry = (payload: unknown): JourneyEntry => {
  if (payload && typeof payload === 'object' && 'journey_entry' in payload) {
    const value = (payload as { journey_entry?: JourneyEntry }).journey_entry;
    if (value) return value;
  }

  return {
    status: 'none',
    track_id: null,
    active_plan_id: null,
    recommended_action: 'generate_bundle',
    last_pulse: null,
    has_superseded_versions: false,
  };
};

const ReconciliationList = () => {
  const { judgmentId } = useParams<{ judgmentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mountedRef = useMountedRef();
  const intent = (searchParams.get('intent') as ReconciliationIntent | null) || 'repair';
  const [plans, setPlans] = useState<ReconciliationPlan[]>([]);
  const [recommendedPlanId, setRecommendedPlanId] = useState<string | null>(null);
  const [journeyEntry, setJourneyEntry] = useState<JourneyEntry>(normalizeJourneyEntry(null));
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<PlanPreferences>(defaultPreferences);

  const fetchLockRef = useRef(false);
  const generatingLockRef = useRef(false);
  const selectingPlanIdRef = useRef<string | null>(null);
  const staleRef = useRef(false);

  useEffect(() => {
    staleRef.current = false;
    setPlans([]);
    setRecommendedPlanId(null);
    setJourneyEntry(normalizeJourneyEntry(null));
    if (judgmentId) {
      void fetchPlans();
    }
    return () => {
      staleRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [judgmentId, intent]);

  const fetchPlans = async () => {
    if (!judgmentId || fetchLockRef.current) return;
    fetchLockRef.current = true;
    setLoading(true);
    setLoadError(null);
    try {
      const bundle = await getPlans(judgmentId, { intent });
      if (staleRef.current) return;
      setPlans(normalizePlans(bundle));
      setRecommendedPlanId(normalizeRecommendedPlanId(bundle));
      setJourneyEntry(normalizeJourneyEntry(bundle));
    } catch (error: unknown) {
      if (staleRef.current) return;
      const err = error as { code?: string };
      if (err.code === 'NOT_FOUND' || err.code === 'HTTP_404') {
        setPlans([]);
        setRecommendedPlanId(null);
      } else {
        const msg = getErrorMessage(error, 'message.getPlansFail');
        setLoadError(msg);
        setPlans([]);
      }
    } finally {
      fetchLockRef.current = false;
      if (!staleRef.current) setLoading(false);
    }
  };

  const handleGeneratePlans = async (force = false) => {
    if (!judgmentId || generatingLockRef.current) return;
    generatingLockRef.current = true;
    setGenerating(true);
    try {
      const bundle = await generatePlans(judgmentId, {
        intent,
        preferences,
        force_regenerate: force,
      });
      if (!mountedRef.current) return;
      setPlans(normalizePlans(bundle));
      setRecommendedPlanId(normalizeRecommendedPlanId(bundle));
      setJourneyEntry(normalizeJourneyEntry(bundle));
      message.success(force ? '已根據你現在的狀態重新適配。' : '已整理出最適合你們的下一步。');
    } catch (error: unknown) {
      if (mountedRef.current) {
        message.error(getErrorMessage(error, 'message.generatePlansFail'));
      }
    } finally {
      generatingLockRef.current = false;
      if (mountedRef.current) setGenerating(false);
    }
  };

  const handleCommitPlan = async (planId: string) => {
    if (!judgmentId || selectingPlanIdRef.current) return;
    selectingPlanIdRef.current = planId;
    try {
      await selectPlan(planId);
      if (!mountedRef.current) return;
      message.success('已記下你的承諾，接下來可以邀請對方一起試。');
      navigate(`/reconciliation/${judgmentId}/${planId}`);
    } catch (error: unknown) {
      if (mountedRef.current) {
        message.error(getErrorMessage(error, 'message.selectPlanFail'));
      }
    } finally {
      selectingPlanIdRef.current = null;
    }
  };

  const recommendedPlan = useMemo(() => {
    const safePlans = Array.isArray(plans) ? plans : [];
    if (safePlans.length === 0) return null;
    return safePlans.find((plan) => plan.id === recommendedPlanId) || safePlans[0];
  }, [plans, recommendedPlanId]);

  const alternatePlans = useMemo(() => {
    const safePlans = Array.isArray(plans) ? plans : [];
    if (!recommendedPlan) return [];
    return safePlans.filter((plan) => plan.id !== recommendedPlan.id).slice(0, 2);
  }, [plans, recommendedPlan]);

  const handleJourneyContinue = () => {
    if (!judgmentId) return;
    const journeyPath = journeyEntry.journey_context?.primary_cta.path;
    if (journeyPath) {
      navigate(journeyPath);
      return;
    }
    if (journeyEntry.recommended_action === 'resume_daily_step' && journeyEntry.active_plan_id) {
      navigate(`/execution/${journeyEntry.active_plan_id}/checkin`);
      return;
    }
    if (journeyEntry.recommended_action === 'replan_track' && journeyEntry.active_plan_id) {
      navigate(`/execution/${journeyEntry.active_plan_id}/replan`);
      return;
    }
    if (journeyEntry.recommended_action === 'resume_track' && journeyEntry.active_plan_id) {
      navigate(`/reconciliation/${judgmentId}/${journeyEntry.active_plan_id}`);
      return;
    }
    if (journeyEntry.active_plan_id) {
      navigate(`/reconciliation/${judgmentId}/${journeyEntry.active_plan_id}`);
    }
  };

  return (
    <ProtectedRoute>
      <SEO title={t('reconList.title')} description={t('reconList.description')} />
      <div className="reconciliation-list-page" role="main" aria-label={t('reconList.pageLabel')}>
        <div className="page-hero page-hero--centered">
          <AnimatedWrapper animation="fade" delay={100}>
            <div className="page-header flex flex-col items-center" aria-labelledby="reconciliation-title">
              <MediatorAvatar size="medium" animated />
              <Title level={2} id="reconciliation-title" className="font-heading font-bold mt-6 mb-2 text-3xl">
                {intentMeta[intent].title}
              </Title>
              <Paragraph type="secondary" className="text-lg max-w-2xl">
                {intentMeta[intent].subtitle}
              </Paragraph>
              <Tag color="blue" icon={<CompassOutlined />}>
                理解問題 → 選方向 → 選下一步 → 一起開始 → 持續修復
              </Tag>
            </div>
          </AnimatedWrapper>
        </div>

        <div className="max-w-6xl mx-auto px-6 pb-24">
          <AnimatedWrapper animation="slide" direction="down" delay={200} trigger="intersection">
            <Card className="rounded-3xl border border-gray-100 shadow-sm mb-8">
              <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                <div>
                  <Title level={4} className="mb-2">先告訴我，你想要什麼樣的節奏</Title>
                  <Text type="secondary">
                    這些偏好不會把你綁死，它只是幫我把第一個主推薦調得更貼近你們現在的狀態。
                  </Text>
                </div>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Text strong>壓力承受度</Text>
                    <Select
                      value={preferences.pressure_level}
                      onChange={(value) => setPreferences((prev) => ({ ...prev, pressure_level: value }))}
                      style={{ width: '100%', marginTop: 8 }}
                    >
                      <Option value="low">越低壓越好</Option>
                      <Option value="medium">可以有一點深度</Option>
                      <Option value="high">我願意面對比較難的步驟</Option>
                    </Select>
                  </Col>
                  <Col xs={24} md={12}>
                    <Text strong>希望節奏</Text>
                    <Select
                      value={preferences.pace}
                      onChange={(value) => setPreferences((prev) => ({ ...prev, pace: value }))}
                      style={{ width: '100%', marginTop: 8 }}
                    >
                      <Option value="today">今天就能開始</Option>
                      <Option value="this_week">這週內慢慢開始</Option>
                      <Option value="ease_in">先看看，慢一點也可以</Option>
                    </Select>
                  </Col>
                  <Col xs={24} md={12}>
                    <Text strong>偏好方式</Text>
                    <Select
                      mode="multiple"
                      value={preferences.style}
                      onChange={(value) => setPreferences((prev) => ({ ...prev, style: value }))}
                      style={{ width: '100%', marginTop: 8 }}
                      maxTagCount={2}
                    >
                      <Option value="action">先做一點事</Option>
                      <Option value="conversation">用對話靠近</Option>
                      <Option value="companionship">一起相處陪伴</Option>
                      <Option value="distance">先保持低壓距離</Option>
                    </Select>
                  </Col>
                  <Col xs={24} md={12}>
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      <Text strong>是否想邀請對方一起加入</Text>
                      <Space style={{ marginTop: 8 }}>
                        <Switch
                          checked={preferences.invite_partner}
                          onChange={(checked) => setPreferences((prev) => ({ ...prev, invite_partner: checked }))}
                        />
                        <Text type="secondary">{preferences.invite_partner ? '可以，之後再用低壓方式邀請' : '先不要，我想自己先試'}</Text>
                      </Space>
                    </Space>
                  </Col>
                </Row>
                <Space wrap>
                  <Button
                    type="primary"
                    icon={<HeartOutlined />}
                    loading={generating}
                    onClick={() => handleGeneratePlans(plans.length > 0)}
                  >
                    {plans.length > 0 ? '重新適配一次' : '看看最適合你們的下一步'}
                  </Button>
                  {plans.length > 0 && (
                    <Button icon={<ReloadOutlined />} onClick={() => handleGeneratePlans(true)}>
                      強制重新生成
                    </Button>
                  )}
                </Space>
              </Space>
            </Card>
          </AnimatedWrapper>

          {loadError ? (
            <Alert
              type="error"
              showIcon
              title={loadError}
              action={(
                <Space>
                  <Button size="small" onClick={() => fetchPlans()}>{t('common.retry')}</Button>
                  <Button size="small" onClick={() => judgmentId && navigate(`/judgment/${judgmentId}`)}>
                    {t('reconList.backToJudgment')}
                  </Button>
                </Space>
              )}
              style={{ marginBottom: 16 }}
            />
          ) : null}

          <Spin spinning={loading || generating} description={generating ? '正在整理更貼近的方案...' : t('common.loading')}>
            {journeyEntry.status !== 'none' && journeyEntry.active_plan_id ? (
              <Alert
                type={journeyEntry.status === 'replanning' ? 'warning' : journeyEntry.status === 'completed' ? 'success' : 'info'}
                showIcon
                style={{ marginBottom: 16 }}
                message={journeyEntry.journey_context?.title || '你們已經有一輪正在進行中的旅程'}
                description={journeyEntry.journey_context?.body || (
                  journeyEntry.last_pulse
                    ? `最近一次脈搏：距離感 ${journeyEntry.last_pulse.closeness || 'same'}，壓力 ${journeyEntry.last_pulse.stress || 'medium'}。`
                    : '你可以直接回到現在這一輪，而不是重新從頭選一次。'
                )}
                action={(
                  <Button type="primary" size="small" onClick={handleJourneyContinue}>
                    {journeyEntry.journey_context?.primary_cta.label || (
                      journeyEntry.recommended_action === 'resume_daily_step'
                        ? '回到今天的一小步'
                        : journeyEntry.recommended_action === 'replan_track'
                          ? '重新調整這一輪'
                          : journeyEntry.recommended_action === 'resume_track'
                            ? '恢復這一輪'
                            : journeyEntry.recommended_action === 'review_history'
                              ? '回看這一輪'
                              : '查看這一輪'
                    )}
                  </Button>
                )}
              />
            ) : null}
            {!recommendedPlan ? (
              <Empty
                description="還沒有主推薦，先按上方按鈕讓我根據你選的方向與節奏整理一次。"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" onClick={() => handleGeneratePlans(false)}>
                  看看最適合你們的下一步
                </Button>
              </Empty>
            ) : (
              <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                <AnimatedWrapper animation="fade" delay={300}>
                  <Card className="rounded-3xl border border-primary/20 shadow-sm">
                    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                      <Space wrap>
                        <Tag color="success">主推薦</Tag>
                        <Tag color={getPlanTypeTagColor(recommendedPlan.plan_type)}>{getPlanTypeText(recommendedPlan.plan_type)}</Tag>
                        <Tag color={getDifficultyTagColor(recommendedPlan.difficulty_level)}>{getDifficultyText(recommendedPlan.difficulty_level)}</Tag>
                      </Space>
                      <div>
                        <Title level={3} className="mb-2">
                          {recommendedPlan.content?.title || safeParsePlanContent(recommendedPlan.plan_content).title}
                        </Title>
                        <Paragraph className="text-base text-gray-700">
                          {recommendedPlan.content?.description || safeParsePlanContent(recommendedPlan.plan_content).description}
                        </Paragraph>
                      </div>
                      <Row gutter={[24, 24]}>
                        <Col xs={24} md={12}>
                          <Card size="small" variant="borderless" className="bg-gray-50 rounded-2xl">
                            <Text strong>為什麼我先推薦這個</Text>
                            <Paragraph className="mt-2 mb-0">
                              {recommendedPlan.fit_reason || safeParsePlanContent(recommendedPlan.plan_content).fit_reason || '它最貼近你們現在想走的方向和節奏。'}
                            </Paragraph>
                          </Card>
                        </Col>
                        <Col xs={24} md={12}>
                          <Card size="small" variant="borderless" className="bg-gray-50 rounded-2xl">
                            <Text strong>今天就能開始的第一步</Text>
                            <Paragraph className="mt-2 mb-0">
                              {recommendedPlan.first_step || safeParsePlanContent(recommendedPlan.plan_content).first_step}
                            </Paragraph>
                          </Card>
                        </Col>
                      </Row>
                      {(recommendedPlan.do_not_use_when || safeParsePlanContent(recommendedPlan.plan_content).do_not_use_when).length > 0 && (
                        <div>
                          <Text strong>暫時不適合的情況</Text>
                          <ul className="mt-3 pl-5">
                            {(recommendedPlan.do_not_use_when || safeParsePlanContent(recommendedPlan.plan_content).do_not_use_when).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <Space wrap>
                        <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => handleCommitPlan(recommendedPlan.id)}>
                          {recommendedPlan.commitment?.current_user.commitment_status === 'committed' ? '我已準備好，查看工作台' : '我願意先從這個開始'}
                        </Button>
                        <Button onClick={() => navigate(`/reconciliation/${judgmentId}/${recommendedPlan.id}`)}>
                          查看完整方案
                        </Button>
                      </Space>
                    </Space>
                  </Card>
                </AnimatedWrapper>

                {alternatePlans.length > 0 && (
                  <AnimatedWrapper animation="fade" delay={350}>
                    <div>
                      <Title level={4}>你也可以考慮這兩個備選</Title>
                      <Row gutter={[24, 24]}>
                        {alternatePlans.map((plan) => {
                          const parsed = plan.content || safeParsePlanContent(plan.plan_content);
                          return (
                            <Col xs={24} md={12} key={plan.id}>
                              <Card className="rounded-3xl border border-gray-100 shadow-sm h-full">
                                <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                                  <Space wrap>
                                    <Tag color={getPlanTypeTagColor(plan.plan_type)}>{getPlanTypeText(plan.plan_type)}</Tag>
                                    <Tag color={getDifficultyTagColor(plan.difficulty_level)}>{getDifficultyText(plan.difficulty_level)}</Tag>
                                  </Space>
                                  <Title level={4} className="mb-0">{parsed.title}</Title>
                                  <Paragraph ellipsis={{ rows: 3 }} className="mb-0">
                                    {parsed.description}
                                  </Paragraph>
                                  <Text type="secondary">{plan.fit_reason || parsed.fit_reason}</Text>
                                  <Space wrap>
                                    <Button onClick={() => navigate(`/reconciliation/${judgmentId}/${plan.id}`)}>查看詳情</Button>
                                    <Button type="primary" ghost onClick={() => handleCommitPlan(plan.id)}>
                                      我想試這個
                                    </Button>
                                  </Space>
                                </Space>
                              </Card>
                            </Col>
                          );
                        })}
                      </Row>
                    </div>
                  </AnimatedWrapper>
                )}
              </Space>
            )}
          </Spin>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default ReconciliationList;
