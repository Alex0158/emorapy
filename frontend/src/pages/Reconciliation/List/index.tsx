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
  }, [judgmentId, difficultyFilter, typeFilter]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (difficultyFilter !== 'all') {
        filters.difficulty = difficultyFilter;
      }
      if (typeFilter !== 'all') {
        filters.type = typeFilter;
      }
      const plansData = await getPlans(judgmentId!, filters);
      setPlans(plansData);
    } catch (error: any) {
      // 如果是404或方案不存在，可能是尚未生成，不顯示錯誤
      if (error.code === 'NOT_FOUND' || error.code === 'HTTP_404') {
        setPlans([]);
      } else {
        message.error(error.message || '獲取和好方案失敗');
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
      message.success(`已生成 ${generatedPlans.length} 個和好方案`);
      setPlans(generatedPlans);
    } catch (error: any) {
      message.error(error.message || '生成和好方案失敗');
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    try {
      await selectPlan(planId);
      message.success('方案已選擇');
      navigate(`/reconciliation/${judgmentId}/${planId}`);
    } catch (error: any) {
      message.error(error.message || '選擇方案失敗');
    }
  };

  const getDifficultyTag = (difficulty: string) => {
    const map: Record<string, { color: string; text: string }> = {
      easy: { color: 'success', text: '簡單' },
      medium: { color: 'warning', text: '中等' },
      hard: { color: 'error', text: '困難' },
    };
    const config = map[difficulty] || { color: 'default', text: difficulty };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getTypeTag = (type: string) => {
    const map: Record<string, { color: string; text: string }> = {
      activity: { color: 'blue', text: '活動' },
      communication: { color: 'purple', text: '溝通' },
      intimacy: { color: 'pink', text: '親密' },
    };
    const config = map[type] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  return (
    <ProtectedRoute>
      <SEO
        title="和好方案 - 熊媽媽法庭"
        description="選擇適合你們的和好方案"
      />
      <div className="reconciliation-list-page" role="main" aria-label="和好方案列表頁面">
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header" aria-labelledby="reconciliation-title">
            <BearJudge size="medium" animated />
            <Title level={2} id="reconciliation-title">
              和好方案
            </Title>
            <Paragraph type="secondary">選擇適合你們的方案，促進關係修復</Paragraph>
          </div>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="down" delay={200} trigger="intersection">
          <div className="filters-section" role="group" aria-label="篩選">
            <Space wrap>
              <Select
                value={difficultyFilter}
                onChange={setDifficultyFilter}
                style={{ width: 120 }}
                aria-label="篩選難度"
              >
                <Option value="all">全部難度</Option>
                <Option value="easy">簡單</Option>
                <Option value="medium">中等</Option>
                <Option value="hard">困難</Option>
              </Select>

              <Select
                value={typeFilter}
                onChange={setTypeFilter}
                style={{ width: 120 }}
                aria-label="篩選類型"
              >
                <Option value="all">全部類型</Option>
                <Option value="activity">活動</Option>
                <Option value="communication">溝通</Option>
                <Option value="intimacy">親密</Option>
              </Select>
            </Space>
          </div>
        </AnimatedWrapper>

        <Spin spinning={loading || generating} tip={generating ? '正在生成和好方案...' : '加載中...'}>
          {plans.length === 0 ? (
            <AnimatedWrapper animation="fade" delay={300}>
              <Empty 
                description="暫無和好方案" 
                aria-label="空狀態：暫無和好方案"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button
                  type="primary"
                  icon={<HeartOutlined />}
                  onClick={handleGeneratePlans}
                  loading={generating}
                  size="large"
                >
                  生成和好方案
                </Button>
              </Empty>
            </AnimatedWrapper>
          ) : (
            <AnimatedWrapper animation="fade" delay={300} trigger="intersection">
              <Row gutter={[24, 24]} role="list" aria-label="和好方案列表">
                {plans.map((plan, index) => (
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
                            <Tag color="success" icon={<CheckCircleOutlined />} aria-label="已選擇">
                              已選擇
                            </Tag>
                          )
                        }
                      >
                        <div className="plan-header">
                          <Title level={4} id={`plan-title-${plan.id}`}>
                            {plan.plan_content.split('\n')[0]}
                          </Title>
                          <Space>
                            {getTypeTag(plan.plan_type)}
                            {getDifficultyTag(plan.difficulty_level)}
                          </Space>
                        </div>

                        <div className="plan-body">
                          <Paragraph ellipsis={{ rows: 3 }}>
                            {plan.plan_content}
                          </Paragraph>

                          <Space>
                            <Text type="secondary">
                              <ClockCircleOutlined /> {plan.estimated_duration || '未定'} 天
                            </Text>
                          </Space>
                        </div>

                        <div className="plan-footer" role="group" aria-label="方案操作">
                          <Space>
                            <Button
                              type="default"
                              onClick={() => navigate(`/reconciliation/${judgmentId}/${plan.id}`)}
                              aria-label={`查看方案 ${plan.plan_content.split('\n')[0]} 的詳情`}
                            >
                              查看詳情
                            </Button>
                            <Button
                              type="primary"
                              icon={<HeartOutlined />}
                              onClick={() => handleSelectPlan(plan.id)}
                              disabled={plan.user1_selected || plan.user2_selected}
                              aria-label={plan.user1_selected || plan.user2_selected ? '方案已選擇' : '選擇此方案'}
                            >
                              選擇方案
                            </Button>
                          </Space>
                        </div>
                      </Card>
                    </AnimatedWrapper>
                  </Col>
                ))}
              </Row>
            </AnimatedWrapper>
          )}
        </Spin>
      </div>
    </ProtectedRoute>
  );
};

export default ReconciliationList;

