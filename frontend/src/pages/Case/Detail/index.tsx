/**
 * 案件詳情頁面
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
  EditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { getCase, submitCase } from '@/services/api/case';
import type { Case } from '@/types/case';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { formatDateTime } from '@/utils/formatDate';
import './Detail.less';

const { Title, Text, Paragraph } = Typography;

const CaseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [case_, setCase_] = useState<Case | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCase();
    }
  }, [id]);

  const fetchCase = async () => {
    // 檢查 id 是否存在
    if (!id) {
      message.error('案件ID不存在');
      navigate('/case/list');
      return;
    }

    setLoading(true);
    try {
      const caseData = await getCase(id);
      setCase_(caseData);
    } catch (error: any) {
      // 根據錯誤類型提供不同的處理
      const errorMessage = error?.response?.data?.error?.message || error?.message || '獲取案件詳情失敗';
      const errorCode = error?.response?.data?.error?.code;

      if (errorCode === 'NOT_FOUND' || error?.response?.status === 404) {
        message.error('案件不存在');
        setTimeout(() => navigate('/case/list'), 1500);
      } else if (errorCode === 'FORBIDDEN' || error?.response?.status === 403) {
        message.error('您沒有權限查看此案件');
        setTimeout(() => navigate('/case/list'), 1500);
      } else if (error?.response?.status === 401) {
        message.error('請先登錄');
        setTimeout(() => navigate('/login'), 1500);
      } else {
        message.error(errorMessage);
        // 記錄錯誤到日誌（僅開發環境）
        if (import.meta.env.DEV) {
          console.error('Failed to fetch case:', error);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!id) {
      message.error('案件ID不存在');
      return;
    }
    
    setSubmitting(true);
    try {
      await submitCase(id);
      message.success('案件已提交，AI正在分析中...');
      navigate(`/case/${id}/review`);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error?.message || error?.message || '提交案件失敗';
      const errorCode = error?.response?.data?.error?.code;

      if (errorCode === 'CASE_NOT_EDITABLE' || errorCode === 'VALIDATION_ERROR') {
        message.error(errorMessage);
      } else if (error?.response?.status === 403) {
        message.error('您沒有權限提交此案件');
      } else {
        message.error(errorMessage);
        // 記錄錯誤（僅開發環境）
        if (import.meta.env.DEV) {
          console.error('Failed to submit case:', error);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: '草稿' },
      submitted: { color: 'processing', text: '已提交' },
      in_progress: { color: 'warning', text: '審理中' },
      completed: { color: 'success', text: '已完成' },
      cancelled: { color: 'error', text: '已取消' },
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  if (loading) {
    return (
      <div className="case-detail-page">
        <Spin size="large" tip="加載中..." />
      </div>
    );
  }

  if (!case_) {
    return (
      <div className="case-detail-page">
        <Alert message="案件不存在" type="error" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <SEO
        title={`${case_.title} - 案件詳情`}
        description={case_.plaintiff_statement.substring(0, 100)}
      />
      <div className="case-detail-page" role="main" aria-label="案件詳情頁面">
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header" role="navigation" aria-label="頁面操作">
            <Space>
              <Button
                icon={<EyeOutlined />}
                onClick={() => navigate('/case/list')}
                aria-label="返回案件列表"
              >
                返回列表
              </Button>
              {case_.status === 'draft' && (
                <Button
                  icon={<EditOutlined />}
                  onClick={() => {
                    // 編輯功能：可以通過更新案件API實現
                    // 目前先提示用戶，後續可以實現內聯編輯
                    message.info('編輯功能開發中，您可以刪除後重新創建');
                  }}
                  aria-label="編輯案件"
                >
                  編輯
                </Button>
              )}
            </Space>
          </div>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
          <Card role="article" aria-labelledby="case-title">
            <div className="case-header">
              <Title level={2} id="case-title">
                {case_.title}
              </Title>
              <Space>
                {getStatusTag(case_.status)}
                <Tag color="orange">{case_.type}</Tag>
              </Space>
            </div>

            <Descriptions column={2} bordered style={{ marginTop: 24 }} aria-label="案件詳細信息">
              <Descriptions.Item label="案件ID">{case_.id}</Descriptions.Item>
              <Descriptions.Item label="案件類型">{case_.type}</Descriptions.Item>
              <Descriptions.Item label="子類型">{case_.sub_type || '無'}</Descriptions.Item>
              <Descriptions.Item label="審理模式">
                {case_.mode === 'remote' ? '遠程審理模式' : case_.mode === 'collaborative' ? '協同審理模式' : '快速體驗模式'}
              </Descriptions.Item>
              <Descriptions.Item label="創建時間">{formatDateTime(case_.created_at)}</Descriptions.Item>
              <Descriptions.Item label="更新時間">{formatDateTime(case_.updated_at)}</Descriptions.Item>
              {case_.submitted_at && (
                <Descriptions.Item label="提交時間">{formatDateTime(case_.submitted_at)}</Descriptions.Item>
              )}
              {case_.completed_at && (
                <Descriptions.Item label="完成時間">{formatDateTime(case_.completed_at)}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={300} trigger="intersection">
          <Card title="原告陳述" style={{ marginTop: 24 }} role="article" aria-labelledby="plaintiff-statement-title">
            <Paragraph id="plaintiff-statement-title">{case_.plaintiff_statement}</Paragraph>
          </Card>
        </AnimatedWrapper>

        {case_.defendant_statement && (
          <AnimatedWrapper animation="slide" direction="up" delay={350} trigger="intersection">
            <Card title="被告陳述" style={{ marginTop: 24 }} role="article" aria-labelledby="defendant-statement-title">
              <Paragraph id="defendant-statement-title">{case_.defendant_statement}</Paragraph>
            </Card>
          </AnimatedWrapper>
        )}

        {case_.status === 'draft' && (
          <AnimatedWrapper animation="slide" direction="up" delay={400} trigger="intersection">
            <div className="action-section" role="group" aria-label="案件操作">
              <Button
                type="primary"
                size="large"
                icon={<CheckCircleOutlined />}
                onClick={handleSubmit}
                loading={submitting}
                aria-label="提交案件"
                aria-describedby="submit-hint"
              >
                提交案件
              </Button>
              <Text id="submit-hint" type="secondary" style={{ display: 'block', marginTop: 8 }}>
                提交後，AI將自動分析並生成判決
              </Text>
            </div>
          </AnimatedWrapper>
        )}

        {(case_.status === 'submitted' || case_.status === 'in_progress') && (
          <AnimatedWrapper animation="slide" direction="up" delay={400} trigger="intersection">
            <div className="action-section" role="group" aria-label="案件操作">
              <Button
                type="primary"
                size="large"
                icon={<ClockCircleOutlined />}
                onClick={() => navigate(`/case/${id}/review`)}
                aria-label="查看審理進度"
              >
                查看審理進度
              </Button>
            </div>
          </AnimatedWrapper>
        )}

        {case_.status === 'completed' && (
          <AnimatedWrapper animation="slide" direction="up" delay={400} trigger="intersection">
            <div className="action-section" role="group" aria-label="案件操作">
              <Button
                type="primary"
                size="large"
                onClick={async () => {
                  // 通過案件ID獲取判決ID
                  try {
                    const { getJudgmentByCaseId } = await import('@/services/api/judgment');
                    const judgment = await getJudgmentByCaseId(case_.id);
                    if (judgment) {
                      navigate(`/judgment/${judgment.id}`);
                    } else {
                      message.warning('判決尚未生成');
                    }
                  } catch (error: any) {
                    message.error('獲取判決失敗');
                  }
                }}
                aria-label="查看判決結果"
              >
                查看判決結果
              </Button>
            </div>
          </AnimatedWrapper>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default CaseDetail;

