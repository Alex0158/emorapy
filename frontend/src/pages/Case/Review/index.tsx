/**
 * 審理中頁面
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Typography,
  Space,
  Spin,
  Progress,
  message,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { getCase } from '@/services/api/case';
import { getJudgmentByCaseId } from '@/services/api/judgment';
import type { Case } from '@/types/case';
import type { Judgment } from '@/types/judgment';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import BearJudge from '@/components/business/BearJudge';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { usePolling } from '@/hooks/usePolling';
import { POLLING_INTERVAL } from '@/utils/constants';
import './Review.less';

const { Title, Text, Paragraph } = Typography;

const CaseReview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [case_, setCase_] = useState<Case | null>(null);
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCase();
    }
  }, [id]);

  const fetchCase = async () => {
    setLoading(true);
    try {
      const caseData = await getCase(id!);
      setCase_(caseData);
    } catch (error: any) {
      message.error(error.message || '獲取案件詳情失敗');
    } finally {
      setLoading(false);
    }
  };

  const fetchJudgment = async (): Promise<boolean> => {
    if (!id) return false;
    try {
      const judgmentData = await getJudgmentByCaseId(id);
      if (judgmentData) {
        setJudgment(judgmentData);
        return true; // 停止輪詢
      }
      return false; // 繼續輪詢
    } catch (error: any) {
      if (error.code === 'JUDGMENT_NOT_FOUND' || error.code === 'HTTP_404') {
        return false; // 繼續輪詢
      }
      // 記錄錯誤（僅開發環境輸出到console）
      if (import.meta.env.DEV) {
      console.error('Failed to fetch judgment:', error);
      }
      return false;
    }
  };

  const { startPolling, stopPolling, isPolling } = usePolling(fetchJudgment, POLLING_INTERVAL);

  useEffect(() => {
    if (case_ && (case_.status === 'submitted' || case_.status === 'in_progress')) {
      startPolling();
    }
    return () => stopPolling();
  }, [case_, startPolling, stopPolling]);

  useEffect(() => {
    if (judgment) {
      stopPolling();
      // 判決生成完成，可以跳轉到結果頁
    }
  }, [judgment, stopPolling]);

  if (loading) {
    return (
      <div className="case-review-page">
        <Spin size="large" tip="加載中..." />
      </div>
    );
  }

  if (!case_) {
    return (
      <div className="case-review-page">
        <Alert message="案件不存在" type="error" />
      </div>
    );
  }

  if (judgment) {
    return (
      <div className="case-review-page">
        <Card>
          <Alert
            message="判決已生成"
            description="AI已經完成判決分析，請查看判決結果。"
            type="success"
            showIcon
            action={
              <Button type="primary" onClick={() => navigate(`/judgment/${judgment.id}`)}>
                查看判決
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <SEO
        title="審理中 - 熊媽媽法庭"
        description="AI正在分析案件，請稍候..."
      />
      <div className="case-review-page" role="main" aria-label="審理中頁面">
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="review-header" aria-labelledby="review-title">
            <BearJudge size="large" animated />
            <Title level={2} id="review-title">
              AI正在審理中
            </Title>
            <Paragraph type="secondary">
            我們正在認真分析您的案件，請稍候...
          </Paragraph>
          </div>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
          <Card>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div className="progress-section">
              <Progress
                percent={isPolling ? 75 : 100}
                status={isPolling ? 'active' : 'success'}
                strokeColor={{
                  '0%': '#ff8c42',
                  '100%': '#5b9bd5',
                }}
              />
              <Text type="secondary" style={{ display: 'block', marginTop: 16, textAlign: 'center' }}>
                {isPolling ? 'AI正在分析案件並生成判決...' : '判決生成完成'}
              </Text>
            </div>

            <Alert
              message="預計等待時間"
              description="AI分析通常需要30-60秒，請耐心等待。判決生成後會自動跳轉。"
              type="info"
              showIcon
            />

            <div className="case-info">
              <Text strong>案件標題：</Text>
              <Text>{case_.title}</Text>
            </div>
          </Space>
          </Card>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={300} trigger="intersection">
          <div className="action-section">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/case/${id}`)}>
              返回案件詳情
            </Button>
          </div>
        </AnimatedWrapper>
      </div>
    </ProtectedRoute>
  );
};

export default CaseReview;

