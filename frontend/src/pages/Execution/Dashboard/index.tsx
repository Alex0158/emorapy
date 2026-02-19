/**
 * 執行儀表板 - 展示所有執行中/已完成的方案與進度
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Typography,
  Space,
  Tag,
  Progress,
  Empty,
  Spin,
  message,
  Row,
  Col,
} from 'antd';
import { RightOutlined } from '@ant-design/icons';
import { getAllExecutionStatuses } from '@/services/api/execution';
import type { ExecutionStatus } from '@/services/api/execution';
import {
  getExecutionStatusTag,
  getDifficultyText,
  getPlanTypeText,
  getPlanTypeTagColor,
} from '@/utils/statusTags';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { t } from '@/utils/i18n';
import './Dashboard.less';

const { Title, Text } = Typography;

const ExecutionDashboard = () => {
  const navigate = useNavigate();
  const [executions, setExecutions] = useState<ExecutionStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExecutions = async () => {
    setLoading(true);
    try {
      const data = await getAllExecutionStatuses();
      setExecutions(data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.getExecutionStatusFail');
      message.error(msg);
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExecutions();
  }, []);

  const inProgress = executions.filter((e) => e.status === 'in_progress' || e.status === 'pending');
  const completed = executions.filter((e) => e.status === 'completed');

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="execution-dashboard-page">
          <Spin size="large" description={t('common.loading')} style={{ padding: 48, display: 'block', textAlign: 'center' }} />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SEO title={t('execDashboard.title')} description={t('execDashboard.description')} />
      <div className="execution-dashboard-page" role="main" aria-label={t('execDashboard.pageLabel')}>
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header">
            <Title level={2}>{t('execDashboard.heading')}</Title>
            <Text type="secondary">{t('execDashboard.subtitle')}</Text>
          </div>
        </AnimatedWrapper>

        {executions.length === 0 ? (
          <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
            <Card>
              <Empty
                description={t('execDashboard.empty')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Text type="secondary">{t('execDashboard.emptyHint')}</Text>
                <div style={{ marginTop: 16 }}>
                  <Button type="primary" onClick={() => navigate('/case/list')}>
                    {t('execDashboard.goCaseList')}
                  </Button>
                </div>
              </Empty>
            </Card>
          </AnimatedWrapper>
        ) : (
          <>
            {inProgress.length > 0 && (
              <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
                <Title level={4} style={{ marginTop: 24, marginBottom: 12 }}>
                  {t('execDashboard.inProgress')}
                </Title>
                <Row gutter={[16, 16]}>
                  {inProgress.map((item) => (
                    <Col xs={24} sm={24} md={12} lg={8} key={item.plan_id}>
                      <Card
                        className="execution-card"
                        hoverable
                        actions={[
                          <Button
                            type="link"
                            key="checkin"
                            icon={<RightOutlined />}
                            onClick={() => navigate(`/execution/${item.plan_id}/checkin`)}
                          >
                            {t('execDashboard.checkIn')}
                          </Button>,
                        ]}
                      >
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <div className="execution-card-header">
                            <Text strong ellipsis style={{ maxWidth: '100%' }}>
                              {item.plan_summary?.title ?? t('execDashboard.planFallbackTitle').replace('{id}', item.plan_id.slice(0, 8))}
                            </Text>
                            {getExecutionStatusTag(item.status)}
                          </div>
                          {item.plan_summary && (
                            <Space size="small">
                              <Tag color={getPlanTypeTagColor(item.plan_summary.plan_type)}>{getPlanTypeText(item.plan_summary.plan_type)}</Tag>
                              <Tag>{getDifficultyText(item.plan_summary.difficulty_level)}</Tag>
                              {item.plan_summary.estimated_duration != null && (
                                <Text type="secondary">{t('execDashboard.estimatedDays').replace('{days}', String(item.plan_summary.estimated_duration))}</Text>
                              )}
                            </Space>
                          )}
                          <Progress
                            percent={item.progress}
                            status={item.status === 'completed' ? 'success' : 'active'}
                            showInfo
                          />
                        </Space>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </AnimatedWrapper>
            )}

            {completed.length > 0 && (
              <AnimatedWrapper animation="slide" direction="up" delay={300} trigger="intersection">
                <Title level={4} style={{ marginTop: 24, marginBottom: 12 }}>
                  {t('execDashboard.completed')}
                </Title>
                <Row gutter={[16, 16]}>
                  {completed.map((item) => (
                    <Col xs={24} sm={24} md={12} lg={8} key={item.plan_id}>
                      <Card className="execution-card execution-card-completed" size="small">
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <div className="execution-card-header">
                            <Text strong ellipsis style={{ maxWidth: '100%' }}>
                              {item.plan_summary?.title ?? t('execDashboard.planFallbackTitle').replace('{id}', item.plan_id.slice(0, 8))}
                            </Text>
                            {getExecutionStatusTag(item.status)}
                          </div>
                          {item.plan_summary && (
                            <Space size="small">
                              <Tag color={getPlanTypeTagColor(item.plan_summary.plan_type)}>{getPlanTypeText(item.plan_summary.plan_type)}</Tag>
                              <Tag>{getDifficultyText(item.plan_summary.difficulty_level)}</Tag>
                            </Space>
                          )}
                          <Progress percent={100} status="success" showInfo={false} size="small" />
                        </Space>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </AnimatedWrapper>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default ExecutionDashboard;
