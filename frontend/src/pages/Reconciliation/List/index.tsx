/**
 * 和好方案列表頁面
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Typography,
  Space,
  Tag,
  Row,
  Col,
  Select,
  Empty,
  Spin,
  message,
} from 'antd';
import {
  ClockCircleOutlined,
  HeartOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { getPlans, selectPlan, generatePlans } from '@/services/api/reconciliation';
import type { ReconciliationPlan } from '@/services/api/reconciliation';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import MediatorAvatar from '@/components/business/MediatorAvatar';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import {
  getDifficultyText,
  getDifficultyTagColor,
  getPlanTypeText,
  getPlanTypeTagColor,
} from '@/utils/statusTags';
import { t } from '@/utils/i18n';
import { safeParsePlanContent } from '@/utils/planContent';
import './List.less';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const ReconciliationList = () => {
  const { judgmentId } = useParams<{ judgmentId: string }>();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<ReconciliationPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const staleRef = useRef(false);
  useEffect(() => {
    staleRef.current = false;
    setPlans([]);
    if (judgmentId) {
      fetchPlans();
    }
    return () => { staleRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅在篩選/ judgmentId 變化時拉取
  }, [judgmentId, difficultyFilter, typeFilter]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const filters: {
        difficulty?: 'easy' | 'medium' | 'hard';
        type?: 'activity' | 'communication' | 'intimacy';
      } = {};
      if (difficultyFilter !== 'all') {
        filters.difficulty = difficultyFilter as 'easy' | 'medium' | 'hard';
      }
      if (typeFilter !== 'all') {
        filters.type = typeFilter as 'activity' | 'communication' | 'intimacy';
      }
      const plansData = await getPlans(judgmentId!, filters);
      if (staleRef.current) return;
      setPlans(plansData);
    } catch (error: unknown) {
      if (staleRef.current) return;
      const err = error as { code?: string; message?: string };
      if (err.code === 'NOT_FOUND' || err.code === 'HTTP_404') {
        setPlans([]);
      } else {
        message.error(err.message ?? t('message.getPlansFail'));
      }
    } finally {
      if (!staleRef.current) setLoading(false);
    }
  };

  const handleGeneratePlans = async () => {
    if (!judgmentId || generating) return;
    setGenerating(true);
    try {
      const generatedPlans = await generatePlans(judgmentId);
      message.success(t('message.generatePlansSuccessCount').replace('{count}', String(generatedPlans.length)));
      setPlans(generatedPlans);
    } catch (error: unknown) {
      const msg = (error as { message?: string })?.message || t('message.generatePlansFail');
      message.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    if (!judgmentId) return;
    try {
      await selectPlan(planId);
      message.success(t('message.selectPlanSuccess'));
      navigate(`/reconciliation/${judgmentId}/${planId}`);
    } catch (error: unknown) {
      const msg = (error as { message?: string })?.message || t('message.selectPlanFail');
      message.error(msg);
    }
  };

  return (
    <ProtectedRoute>
      <SEO
        title={t('reconList.title')}
        description={t('reconList.description')}
      />
      <div className="reconciliation-list-page" role="main" aria-label={t('reconList.pageLabel')}>
        <div className="adaptive-hero-section mb-12 bg-gradient-to-br from-background to-gray-50 rounded-b-[40px] shadow-sm p-8 text-center">
          <AnimatedWrapper animation="fade" delay={100}>
            <div className="page-header flex flex-col items-center" aria-labelledby="reconciliation-title">
              <MediatorAvatar size="medium" animated />
              <Title level={2} id="reconciliation-title" className="font-heading font-bold mt-6 mb-2 text-3xl">
                {t('reconList.heading')}
              </Title>
              <Paragraph type="secondary" className="text-lg max-w-2xl">{t('reconList.subtitle')}</Paragraph>
            </div>
          </AnimatedWrapper>
        </div>

        <div className="max-w-6xl mx-auto px-6 pb-24">
          <AnimatedWrapper animation="slide" direction="down" delay={200} trigger="intersection">
            <div className="filters-section bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-8" role="group" aria-label={t('reconList.filtersLabel')}>
              <Space wrap>
                <Select
                  value={difficultyFilter}
                  onChange={setDifficultyFilter}
                  style={{ width: 140 }}
                  aria-label={t('reconList.ariaDifficultyFilter')}
                  className="rounded-lg"
                >
                  <Option value="all">{t('reconList.difficultyAll')}</Option>
                  <Option value="easy">{t('reconList.difficultyEasy')}</Option>
                  <Option value="medium">{t('reconList.difficultyMedium')}</Option>
                  <Option value="hard">{t('reconList.difficultyHard')}</Option>
                </Select>

                <Select
                  value={typeFilter}
                  onChange={setTypeFilter}
                  style={{ width: 140 }}
                  aria-label={t('reconList.ariaTypeFilter')}
                  className="rounded-lg"
                >
                  <Option value="all">{t('reconList.typeAll')}</Option>
                  <Option value="activity">{t('reconList.typeActivity')}</Option>
                  <Option value="communication">{t('reconList.typeCommunication')}</Option>
                  <Option value="intimacy">{t('reconList.typeIntimacy')}</Option>
                </Select>
              </Space>
            </div>
          </AnimatedWrapper>

        <Spin spinning={loading || generating} description={generating ? t('reconList.generating') : t('common.loading')}>
          {plans.length === 0 ? (
            <AnimatedWrapper animation="fade" delay={300}>
              <Empty
                description={t('reconList.empty')}
                aria-label={t('reconList.empty')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button
                  type="primary"
                  icon={<HeartOutlined />}
                  onClick={handleGeneratePlans}
                  loading={generating}
                  size="large"
                >
                  {t('reconList.generatePlans')}
                </Button>
              </Empty>
            </AnimatedWrapper>
          ) : (
            <AnimatedWrapper animation="fade" delay={300}>
              <Row gutter={[24, 24]} role="list" aria-label={t('reconList.heading')}>
                {plans.map((plan, index) => {
                  const parsed = safeParsePlanContent(plan.plan_content);
                  const planTitle = parsed.title;
                  return (
                    <Col xs={24} sm={12} key={plan.id}>
                      <AnimatedWrapper
                        animation="slide"
                        direction="up"
                        delay={index * 50}
                      >
                        <Card
                          className="plan-card h-full transition-all duration-300 border border-gray-100 rounded-3xl hover:-translate-y-1 hover:shadow-xl hover:border-primary/30 bg-white"
                          hoverable
                          role="article"
                          aria-labelledby={`plan-title-${plan.id}`}
                          tabIndex={0}
                          extra={
                            (plan.user1_selected || plan.user2_selected) && (
                              <Tag color="success" icon={<CheckCircleOutlined />} aria-label={t('reconList.selected')} className="rounded-full px-3 py-1">
                                {t('reconList.selected')}
                              </Tag>
                            )
                          }
                        >
                          <div className="plan-header mb-4 flex justify-between items-start gap-4">
                            <Title level={4} id={`plan-title-${plan.id}`} className="font-heading m-0 flex-1">
                              {planTitle}
                            </Title>
                            <Space className="flex-shrink-0">
                              <Tag color={getPlanTypeTagColor(plan.plan_type)} className="rounded-full">{getPlanTypeText(plan.plan_type)}</Tag>
                              <Tag color={getDifficultyTagColor(plan.difficulty_level)} className="rounded-full">{getDifficultyText(plan.difficulty_level)}</Tag>
                            </Space>
                          </div>

                          <div className="plan-body mb-6">
                            <Paragraph ellipsis={{ rows: 3 }} className="text-gray-600 text-base leading-relaxed">
                              {parsed.description}
                            </Paragraph>

                            <Space className="mt-4 bg-gray-50 px-4 py-2 rounded-xl w-full">
                              <Text type="secondary" className="flex items-center gap-2">
                                <ClockCircleOutlined className="text-primary" /> {plan.estimated_duration != null ? t('reconList.estimatedDays').replace('{days}', String(plan.estimated_duration)) : t('reconList.estimatedTbd')}
                              </Text>
                            </Space>
                          </div>

                          <div className="plan-footer pt-4 border-t border-gray-100 flex justify-end" role="group" aria-label={t('reconList.ariaPlanActions')}>
                            <Space>
                              <Button
                                type="default"
                                shape="round"
                                onClick={() => navigate(`/reconciliation/${judgmentId}/${plan.id}`)}
                                aria-label={t('reconList.viewDetailAria').replace('{title}', planTitle)}
                              >
                                {t('reconList.viewDetail')}
                              </Button>
                              <Button
                                type="primary"
                                shape="round"
                                icon={<HeartOutlined />}
                                onClick={() => handleSelectPlan(plan.id)}
                                disabled={plan.user1_selected || plan.user2_selected}
                                aria-label={plan.user1_selected || plan.user2_selected ? t('reconList.planSelectedAria') : t('reconList.selectPlanAria')}
                              >
                                {t('reconList.selectPlan')}
                              </Button>
                            </Space>
                          </div>
                        </Card>
                      </AnimatedWrapper>
                    </Col>
                  );
                })}
              </Row>
            </AnimatedWrapper>
          )}
        </Spin>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default ReconciliationList;

