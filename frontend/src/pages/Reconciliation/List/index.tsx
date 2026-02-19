/**
 * 和好方案列表頁面
 */

import { useState, useEffect } from 'react';
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
import BearJudge from '@/components/business/BearJudge';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import {
  getDifficultyText,
  getDifficultyTagColor,
  getPlanTypeText,
  getPlanTypeTagColor,
} from '@/utils/statusTags';
import { t } from '@/utils/i18n';
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

  useEffect(() => {
    if (judgmentId) {
      fetchPlans();
    }
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
      setPlans(plansData);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      // 如果是404或方案不存在，可能是尚未生成，不顯示錯誤
      if (err.code === 'NOT_FOUND' || err.code === 'HTTP_404') {
        setPlans([]);
      } else {
        message.error(err.message ?? t('message.getPlansFail'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePlans = async () => {
    if (!judgmentId) return;
    setGenerating(true);
    try {
      const generatedPlans = await generatePlans(judgmentId);
      message.success(t('message.generatePlansSuccessCount').replace('{count}', String(generatedPlans.length)));
      setPlans(generatedPlans);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.generatePlansFail');
      message.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    try {
      await selectPlan(planId);
      message.success(t('message.selectPlanSuccess'));
      navigate(`/reconciliation/${judgmentId}/${planId}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.selectPlanFail');
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
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header" aria-labelledby="reconciliation-title">
            <BearJudge size="medium" animated />
            <Title level={2} id="reconciliation-title">
              {t('reconList.heading')}
            </Title>
            <Paragraph type="secondary">{t('reconList.subtitle')}</Paragraph>
          </div>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="down" delay={200} trigger="intersection">
          <div className="filters-section" role="group" aria-label={t('reconList.filtersLabel')}>
            <Space wrap>
              <Select
                value={difficultyFilter}
                onChange={setDifficultyFilter}
                style={{ width: 120 }}
                aria-label={t('reconList.ariaDifficultyFilter')}
              >
                <Option value="all">{t('reconList.difficultyAll')}</Option>
                <Option value="easy">{t('reconList.difficultyEasy')}</Option>
                <Option value="medium">{t('reconList.difficultyMedium')}</Option>
                <Option value="hard">{t('reconList.difficultyHard')}</Option>
              </Select>

              <Select
                value={typeFilter}
                onChange={setTypeFilter}
                style={{ width: 120 }}
                aria-label={t('reconList.ariaTypeFilter')}
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
            <AnimatedWrapper animation="fade" delay={300} trigger="intersection">
              <Row gutter={[24, 24]} role="list" aria-label={t('reconList.heading')}>
                {plans.map((plan, index) => {
                  const planTitle = plan.plan_content.split('\n')[0];
                  return (
                    <Col xs={24} sm={12} key={plan.id}>
                      <AnimatedWrapper
                        animation="slide"
                        direction="up"
                        delay={index * 50}
                        trigger="intersection"
                      >
                        <Card
                          className="plan-card"
                          hoverable
                          role="article"
                          aria-labelledby={`plan-title-${plan.id}`}
                          tabIndex={0}
                          extra={
                            (plan.user1_selected || plan.user2_selected) && (
                              <Tag color="success" icon={<CheckCircleOutlined />} aria-label={t('reconList.selected')}>
                                {t('reconList.selected')}
                              </Tag>
                            )
                          }
                        >
                          <div className="plan-header">
                            <Title level={4} id={`plan-title-${plan.id}`}>
                              {planTitle}
                            </Title>
                            <Space>
                              <Tag color={getPlanTypeTagColor(plan.plan_type)}>{getPlanTypeText(plan.plan_type)}</Tag>
                              <Tag color={getDifficultyTagColor(plan.difficulty_level)}>{getDifficultyText(plan.difficulty_level)}</Tag>
                            </Space>
                          </div>

                          <div className="plan-body">
                            <Paragraph ellipsis={{ rows: 3 }}>
                              {plan.plan_content}
                            </Paragraph>

                            <Space>
                              <Text type="secondary">
                                <ClockCircleOutlined /> {plan.estimated_duration != null ? t('reconList.estimatedDays').replace('{days}', String(plan.estimated_duration)) : `${t('reconList.estimatedTbd')} 天`}
                              </Text>
                            </Space>
                          </div>

                          <div className="plan-footer" role="group" aria-label={t('reconList.ariaPlanActions')}>
                            <Space>
                              <Button
                                type="default"
                                onClick={() => navigate(`/reconciliation/${judgmentId}/${plan.id}`)}
                                aria-label={t('reconList.viewDetailAria').replace('{title}', planTitle)}
                              >
                                {t('reconList.viewDetail')}
                              </Button>
                              <Button
                                type="primary"
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
    </ProtectedRoute>
  );
};

export default ReconciliationList;

