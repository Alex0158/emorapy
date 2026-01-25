/**
 * 和好方案詳情頁面
 */

import { useState, useEffect } from 'react';
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
import './Detail.less';

const { Title, Paragraph } = Typography;

const ReconciliationDetail = () => {
  const { judgmentId, id } = useParams<{ judgmentId: string; id: string }>();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<ReconciliationPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (judgmentId && id) {
      fetchPlan();
    }
  }, [judgmentId, id]);

  const fetchPlan = async () => {
    setLoading(true);
    try {
      // 優先使用getPlanById獲取詳情（更高效）
      if (id) {
        try {
          const planDetail = await getPlanById(id);
          setPlan(planDetail as ReconciliationPlan);
        } catch {
          // 如果getPlanById失敗，回退到getPlans
          const plans = await getPlans(judgmentId!);
          const foundPlan = plans.find((p) => p.id === id);
          if (foundPlan) {
            setPlan(foundPlan);
          } else {
            message.error('方案不存在');
          }
        }
      } else {
        message.error('方案ID不存在');
      }
    } catch (error: any) {
      message.error(error.message || '獲取方案詳情失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async () => {
    if (!id) return;
    try {
      await selectPlan(id);
      message.success('方案已選擇');
      fetchPlan();
    } catch (error: any) {
      message.error(error.message || '選擇方案失敗');
    }
  };

  const handleStartExecution = async () => {
    if (!id) return;
    setExecuting(true);
    try {
      await confirmExecution(id);
      message.success('已開始執行方案');
      navigate(`/execution/${id}/checkin`);
    } catch (error: any) {
      message.error(error.message || '開始執行失敗');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="reconciliation-detail-page">
        <Spin size="large" tip="加載中..." />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="reconciliation-detail-page">
        <Alert message="方案不存在" type="error" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <SEO
        title="和好方案詳情 - 熊媽媽法庭"
        description={plan.plan_content.substring(0, 100)}
      />
      <div className="reconciliation-detail-page" role="main" aria-label="和好方案詳情頁面">
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header" aria-labelledby="plan-title">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} aria-label="返回上一頁">
              返回
            </Button>
          </div>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
          <Card role="article" aria-labelledby="plan-title">
          <div className="plan-header">
            <Title level={2}>{plan.plan_content.split('\n')[0]}</Title>
            <Space>
              <Tag color="blue">{plan.plan_type}</Tag>
              <Tag color={plan.difficulty_level === 'easy' ? 'success' : plan.difficulty_level === 'medium' ? 'warning' : 'error'}>
                {plan.difficulty_level === 'easy' ? '簡單' : plan.difficulty_level === 'medium' ? '中等' : '困難'}
              </Tag>
            </Space>
          </div>

          <Descriptions column={2} bordered style={{ marginTop: 24 }}>
            <Descriptions.Item label="方案類型">
              {plan.plan_type === 'activity' ? '活動' : plan.plan_type === 'communication' ? '溝通' : '親密'}
            </Descriptions.Item>
            <Descriptions.Item label="難度等級">
              {plan.difficulty_level === 'easy' ? '簡單' : plan.difficulty_level === 'medium' ? '中等' : '困難'}
            </Descriptions.Item>
            <Descriptions.Item label="預計時長">
              {plan.estimated_duration || '未定'} 天
            </Descriptions.Item>
            <Descriptions.Item label="時間成本">{plan.time_cost}/5</Descriptions.Item>
            <Descriptions.Item label="金錢成本">{plan.money_cost}/5</Descriptions.Item>
            <Descriptions.Item label="情感成本">{plan.emotion_cost}/5</Descriptions.Item>
          </Descriptions>
          </Card>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={300} trigger="intersection">
          <Card title="方案內容" style={{ marginTop: 24 }}>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{plan.plan_content}</Paragraph>
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
                選擇此方案
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
                開始執行
              </Button>
            )}

            <Alert
              message="執行提示"
              description="選擇方案後，您可以開始執行並記錄執行情況。"
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

