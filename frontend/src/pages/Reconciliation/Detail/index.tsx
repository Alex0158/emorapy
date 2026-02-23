/**
 * 和好方案詳情頁面
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Typography,
  Space,
  Tag,
  Descriptions,
  Spin,
  message,
  Alert,
} from 'antd';
import {
  CheckCircleOutlined,
  ArrowLeftOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { getPlans, selectPlan, getPlanById } from '@/services/api/reconciliation';
import { confirmExecution } from '@/services/api/execution';
import type { ReconciliationPlan } from '@/services/api/reconciliation';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { t } from '@/utils/i18n';
import { safeParsePlanContent } from '@/utils/planContent';
import './Detail.less';

const { Title, Paragraph } = Typography;

const ReconciliationDetail = () => {
  const { judgmentId, id } = useParams<{ judgmentId: string; id: string }>();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<ReconciliationPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  const staleRef = useRef(false);
  useEffect(() => {
    staleRef.current = false;
    setPlan(null);
    if (judgmentId && id) {
      fetchPlan();
    }
    return () => { staleRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅在 judgmentId/id 變化時拉取
  }, [judgmentId, id]);

  const fetchPlan = async () => {
    setLoading(true);
    try {
      if (id) {
        try {
          const planDetail = await getPlanById(id);
          if (staleRef.current) return;
          setPlan(planDetail as ReconciliationPlan);
        } catch {
          if (staleRef.current) return;
          if (!judgmentId) {
            message.error(t('message.planNotFound'));
            return;
          }
          const plans = await getPlans(judgmentId);
          if (staleRef.current) return;
          const foundPlan = plans.find((p) => p.id === id);
          if (foundPlan) {
            setPlan(foundPlan);
          } else {
            message.error(t('message.planNotFound'));
          }
        }
      } else {
        message.error(t('message.planIdMissing'));
      }
    } catch (error: unknown) {
      if (staleRef.current) return;
      const msg = (error as { message?: string })?.message || t('message.getPlanDetailFail');
      message.error(msg);
    } finally {
      if (!staleRef.current) setLoading(false);
    }
  };

  const handleSelect = async () => {
    if (!id) return;
    try {
      await selectPlan(id);
      message.success(t('message.selectPlanSuccess'));
      fetchPlan();
    } catch (error: unknown) {
      const msg = (error as { message?: string })?.message || t('message.selectPlanFail');
      message.error(msg);
    }
  };

  const handleStartExecution = async () => {
    if (!id || executing) return;
    setExecuting(true);
    try {
      await confirmExecution(id);
      message.success(t('message.startExecutionSuccess'));
      navigate(`/execution/${id}/checkin`);
    } catch (error: unknown) {
      const msg = (error as { message?: string })?.message || t('message.startExecutionFail');
      message.error(msg);
    } finally {
      setExecuting(false);
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
        <Alert message={t('message.planNotFound')} type="error" />
      </div>
    );
  }

  const difficultyLabel = plan.difficulty_level === 'easy' ? t('reconList.difficultyEasy') : plan.difficulty_level === 'medium' ? t('reconList.difficultyMedium') : t('reconList.difficultyHard');
  const typeLabel = plan.plan_type === 'activity' ? t('reconList.typeActivity') : plan.plan_type === 'communication' ? t('reconList.typeCommunication') : t('reconList.typeIntimacy');

  return (
    <ProtectedRoute>
      <SEO
        title={t('reconDetail.pageTitle')}
        description={safeParsePlanContent(plan.plan_content).description.substring(0, 100)}
      />
      <div className="reconciliation-detail-page" role="main" aria-label={t('reconDetail.pageLabel')}>
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header" aria-labelledby="plan-title">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} aria-label={t('reconDetail.backAria')}>
              {t('reconDetail.back')}
            </Button>
          </div>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
          <Card role="article" aria-labelledby="plan-title">
          <div className="plan-header">
            <Title level={2}>{safeParsePlanContent(plan.plan_content).title}</Title>
            <Space>
              <Tag color="blue">{typeLabel}</Tag>
              <Tag color={plan.difficulty_level === 'easy' ? 'success' : plan.difficulty_level === 'medium' ? 'warning' : 'error'}>
                {difficultyLabel}
              </Tag>
            </Space>
          </div>

          <Descriptions column={2} bordered style={{ marginTop: 24 }}>
            <Descriptions.Item label={t('reconDetail.planType')}>{typeLabel}</Descriptions.Item>
            <Descriptions.Item label={t('reconDetail.difficultyLevel')}>{difficultyLabel}</Descriptions.Item>
            <Descriptions.Item label={t('reconDetail.estimatedDuration')}>
              {plan.estimated_duration != null ? t('reconList.estimatedDays').replace('{days}', String(plan.estimated_duration)) : t('reconList.estimatedTbd')}
            </Descriptions.Item>
            <Descriptions.Item label={t('reconDetail.timeCost')}>{plan.time_cost}/5</Descriptions.Item>
            <Descriptions.Item label={t('reconDetail.moneyCost')}>{plan.money_cost}/5</Descriptions.Item>
            <Descriptions.Item label={t('reconDetail.emotionCost')}>{plan.emotion_cost}/5</Descriptions.Item>
          </Descriptions>
          </Card>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={300} trigger="intersection">
          <Card title={t('reconDetail.contentTitle')} style={{ marginTop: 24 }}>
            {(() => {
              const parsed = safeParsePlanContent(plan.plan_content);
              return (
                <>
                  <Paragraph>{parsed.description}</Paragraph>
                  {parsed.steps.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <Title level={5}>{t('reconDetail.steps')}</Title>
                      <ol>{parsed.steps.map((step, i) => <li key={i}><Paragraph>{step}</Paragraph></li>)}</ol>
                    </div>
                  )}
                  {parsed.expected_effect && (
                    <div style={{ marginTop: 16 }}>
                      <Title level={5}>{t('reconDetail.expectedEffect')}</Title>
                      <Paragraph>{parsed.expected_effect}</Paragraph>
                    </div>
                  )}
                </>
              );
            })()}
          </Card>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={400} trigger="intersection">
          <div className="action-section">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {!plan.user1_selected && !plan.user2_selected && (
              <Button
                type="primary"
                size="large"
                icon={<CheckCircleOutlined />}
                onClick={handleSelect}
                block
              >
                {t('reconDetail.selectThisPlan')}
              </Button>
            )}

            {(plan.user1_selected || plan.user2_selected) && (
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={handleStartExecution}
                loading={executing}
                block
              >
                {t('reconDetail.startExecution')}
              </Button>
            )}

            <Alert
              message={t('reconDetail.execHintTitle')}
              description={t('reconDetail.execHintDesc')}
              type="info"
              showIcon
            />
          </Space>
          </div>
        </AnimatedWrapper>
      </div>
    </ProtectedRoute>
  );
};

export default ReconciliationDetail;

