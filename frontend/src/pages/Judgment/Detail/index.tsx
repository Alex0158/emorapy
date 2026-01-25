/**
 * 判決詳情頁面（優化版）
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Typography,
  Space,
  Rate,
  Modal,
  message,
  Spin,
  Alert,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  HeartOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { getJudgment, acceptJudgment } from '@/services/api/judgment';
import { generatePlans } from '@/services/api/reconciliation';
import type { Judgment } from '@/types/judgment';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import BearJudge from '@/components/business/BearJudge';
import JudgmentViewer from '@/components/business/JudgmentViewer';
import ResponsibilityRatio from '@/components/business/ResponsibilityRatio';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import './Detail.less';

const { Title, Text } = Typography;

const JudgmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [rating, setRating] = useState(0);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchJudgment();
    }
  }, [id]);

  const fetchJudgment = async () => {
    setLoading(true);
    try {
      const judgmentData = await getJudgment(id!);
      setJudgment(judgmentData);
      if (judgmentData.user1_rating) {
        setRating(judgmentData.user1_rating);
      }
    } catch (error: any) {
      message.error(error.message || '獲取判決詳情失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!id) return;
    setAccepting(true);
    try {
      await acceptJudgment(id, { accepted: true, rating: rating || undefined });
      message.success('已接受判決');
      setShowAcceptModal(false);
      fetchJudgment(); // 刷新數據
    } catch (error: any) {
      message.error(error.message || '操作失敗');
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    setAccepting(true);
    try {
      await acceptJudgment(id, { accepted: false });
      message.success('已拒絕判決');
      setShowRejectModal(false);
      fetchJudgment(); // 刷新數據
    } catch (error: any) {
      message.error(error.message || '操作失敗');
    } finally {
      setAccepting(false);
    }
  };

  const handleGeneratePlans = async () => {
    if (!id) return;
    setGenerating(true);
    try {
      await generatePlans(id);
      message.success('和好方案已生成');
      navigate(`/reconciliation/${id}`);
    } catch (error: any) {
      message.error(error.message || '生成和好方案失敗');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="judgment-detail-page">
        <Spin size="large" tip="加載中..." />
      </div>
    );
  }

  if (!judgment) {
    return (
      <div className="judgment-detail-page">
        <Alert message="判決不存在" type="error" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <SEO
        title="判決詳情 - 熊媽媽法庭"
        description="查看完整的AI判決結果"
      />
      <div className="judgment-detail-page" role="main" aria-label="判決詳情頁面">
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header" role="navigation" aria-label="頁面操作">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
              aria-label="返回上一頁"
            >
              返回
            </Button>
          </div>
        </AnimatedWrapper>

        <AnimatedWrapper animation="fade" delay={200}>
          <div className="judgment-header" aria-labelledby="judgment-title">
            <BearJudge size="large" animated />
            <Title level={2} id="judgment-title">
              判決結果
            </Title>
            <Text type="secondary">基於AI分析的公正判決</Text>
          </div>
        </AnimatedWrapper>

        <AnimatedWrapper animation="scale" delay={300} trigger="intersection">
          <Card className="responsibility-card" role="article" aria-labelledby="responsibility-title">
            <Title level={3} id="responsibility-title">
              責任分比例
            </Title>
            <ResponsibilityRatio
              ratio={useMemo(
                () =>
                  judgment.responsibility_ratio ?? {
                    plaintiff: judgment.plaintiff_ratio,
                    defendant: judgment.defendant_ratio,
                  },
                [judgment.plaintiff_ratio, judgment.defendant_ratio, judgment.responsibility_ratio]
              )}
              showLabels={true}
              size="large"
            />
          </Card>
        </AnimatedWrapper>

        <AnimatedWrapper animation="fade" delay={400} trigger="intersection">
          <Card className="judgment-content-card" role="article" aria-labelledby="judgment-content-title">
            <JudgmentViewer
              content={judgment.judgment_content}
              title="判決書"
              showActions={true}
            />
          </Card>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={500} trigger="intersection">
          <Card className="action-card" role="article" aria-labelledby="feedback-title">
            <Title level={4} id="feedback-title">
              您的反饋
            </Title>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div role="group" aria-label="評分">
                <Text>評分（可選）：</Text>
                <Rate
                  value={rating}
                  onChange={setRating}
                  style={{ marginLeft: 8 }}
                  aria-label="判決評分"
                />
              </div>

              <Space role="group" aria-label="判決操作">
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => setShowAcceptModal(true)}
                  disabled={judgment.user1_acceptance !== undefined}
                  aria-label="接受判決"
                >
                  接受判決
                </Button>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setShowRejectModal(true)}
                  disabled={judgment.user1_acceptance !== undefined}
                  aria-label="拒絕判決"
                >
                  拒絕判決
                </Button>
                <Button
                  type="default"
                  icon={<HeartOutlined />}
                  onClick={handleGeneratePlans}
                  loading={generating}
                  aria-label="生成和好方案"
                >
                  生成和好方案
                </Button>
              </Space>

            {judgment.user1_acceptance !== undefined && (
              <Alert
                message={judgment.user1_acceptance ? '您已接受此判決' : '您已拒絕此判決'}
                type={judgment.user1_acceptance ? 'success' : 'warning'}
                showIcon
                role="status"
                aria-live="polite"
              />
            )}
          </Space>
          </Card>
        </AnimatedWrapper>

        <Modal
          title="接受判決"
          open={showAcceptModal}
          onOk={handleAccept}
          onCancel={() => setShowAcceptModal(false)}
          confirmLoading={accepting}
        >
          <p>確定要接受此判決嗎？</p>
          {rating > 0 && <p>您的評分：{rating} 星</p>}
        </Modal>

        <Modal
          title="拒絕判決"
          open={showRejectModal}
          onOk={handleReject}
          onCancel={() => setShowRejectModal(false)}
          confirmLoading={accepting}
        >
          <p>確定要拒絕此判決嗎？您可以申請重新審理。</p>
        </Modal>
      </div>
    </ProtectedRoute>
  );
};

export default JudgmentDetail;
