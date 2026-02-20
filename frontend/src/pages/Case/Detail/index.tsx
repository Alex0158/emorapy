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
import { logger } from '@/utils/logger';
import { getCaseStatusTag } from '@/utils/statusTags';
import { t } from '@/utils/i18n';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅在 id 變化時拉取，fetchCase 不進 deps
  }, [id]);

  const fetchCase = async () => {
    if (!id) {
      message.error(t('message.caseIdMissing'));
      navigate('/case/list');
      return;
    }

    setLoading(true);
    try {
      const caseData = await getCase(id);
      setCase_(caseData);
    } catch (error: unknown) {
      type ErrShape = { response?: { data?: { error?: { message?: string; code?: string } }; status?: number }; message?: string };
      const err = error as ErrShape;
      const errorMessage = err?.response?.data?.error?.message || err?.message || t('common.getCaseFail');
      const errorCode = err?.response?.data?.error?.code;

      if (errorCode === 'NOT_FOUND' || err?.response?.status === 404) {
        message.error(t('common.caseNotFound'));
        setTimeout(() => navigate('/case/list'), 1500);
      } else if (errorCode === 'FORBIDDEN' || err?.response?.status === 403) {
        message.error(t('message.noPermissionViewCase'));
        setTimeout(() => navigate('/case/list'), 1500);
      } else if (err?.response?.status === 401) {
        message.error(t('message.pleaseLogin'));
        setTimeout(() => navigate('/auth/login'), 1500);
      } else {
        message.error(errorMessage);
        logger.error('Failed to fetch case', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!id) {
      message.error(t('message.caseIdMissing'));
      return;
    }

    setSubmitting(true);
    try {
      await submitCase(id);
      message.success(t('message.submitCaseSuccess'));
      navigate(`/case/${id}/review`);
    } catch (error: unknown) {
      type ErrShape = { response?: { data?: { error?: { message?: string; code?: string } }; status?: number }; message?: string };
      const err = error as ErrShape;
      const errorMessage = err?.response?.data?.error?.message || err?.message || t('message.submitCaseFail');
      const errorCode = err?.response?.data?.error?.code;

      if (errorCode === 'CASE_NOT_EDITABLE' || errorCode === 'VALIDATION_ERROR') {
        message.error(errorMessage);
      } else if (err?.response?.status === 403) {
        message.error(t('message.noPermissionSubmitCase'));
      } else {
        message.error(errorMessage);
        logger.error('Failed to submit case', error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="case-detail-page">
        <Spin size="large" description={t('common.loading')} />
      </div>
    );
  }

  if (!case_) {
    return (
      <div className="case-detail-page">
        <Alert message={t('common.caseNotFound')} type="error" />
      </div>
    );
  }

  const modeLabel =
    case_.mode === 'remote'
      ? t('caseDetail.modeRemote')
      : case_.mode === 'collaborative'
        ? t('caseDetail.modeCollaborative')
        : t('caseDetail.modeQuick');

  return (
    <ProtectedRoute>
      <SEO
        title={`${case_.title}${t('caseDetail.titleSuffix')}`}
        description={case_.plaintiff_statement.substring(0, 100)}
      />
      <div className="case-detail-page" role="main" aria-label={t('caseDetail.pageLabel')}>
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header" role="navigation" aria-label={t('caseDetail.actionsLabel')}>
            <Space>
              <Button
                icon={<EyeOutlined />}
                onClick={() => navigate('/case/list')}
                aria-label={t('caseDetail.backListAria')}
              >
                {t('caseDetail.backList')}
              </Button>
              {case_.status === 'draft' && (
                <Button
                  icon={<EditOutlined />}
                  onClick={() => {
                    message.info(t('message.editComingSoon'));
                  }}
                  aria-label={t('caseDetail.editAria')}
                >
                  {t('caseDetail.edit')}
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
                {getCaseStatusTag(case_.status)}
                <Tag color="orange">{case_.type}</Tag>
              </Space>
            </div>

            <Descriptions column={2} bordered style={{ marginTop: 24 }} aria-label={t('caseDetail.descLabel')}>
              <Descriptions.Item label={t('caseDetail.caseId')}>{case_.id}</Descriptions.Item>
              <Descriptions.Item label={t('caseDetail.caseType')}>{case_.type}</Descriptions.Item>
              <Descriptions.Item label={t('caseDetail.subType')}>{case_.sub_type || t('caseDetail.subTypeNone')}</Descriptions.Item>
              <Descriptions.Item label={t('caseDetail.mode')}>{modeLabel}</Descriptions.Item>
              <Descriptions.Item label={t('caseDetail.createdAt')}>{formatDateTime(case_.created_at)}</Descriptions.Item>
              <Descriptions.Item label={t('caseDetail.updatedAt')}>{formatDateTime(case_.updated_at)}</Descriptions.Item>
              {case_.submitted_at && (
                <Descriptions.Item label={t('caseDetail.submittedAt')}>{formatDateTime(case_.submitted_at)}</Descriptions.Item>
              )}
              {case_.completed_at && (
                <Descriptions.Item label={t('caseDetail.completedAt')}>{formatDateTime(case_.completed_at)}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={300} trigger="intersection">
          <Card title={t('caseDetail.plaintiffStatement')} style={{ marginTop: 24 }} role="article" aria-labelledby="plaintiff-statement-title">
            <Paragraph id="plaintiff-statement-title">{case_.plaintiff_statement}</Paragraph>
          </Card>
        </AnimatedWrapper>

        {case_.defendant_statement && (
          <AnimatedWrapper animation="slide" direction="up" delay={350} trigger="intersection">
            <Card title={t('caseDetail.defendantStatement')} style={{ marginTop: 24 }} role="article" aria-labelledby="defendant-statement-title">
              <Paragraph id="defendant-statement-title">{case_.defendant_statement}</Paragraph>
            </Card>
          </AnimatedWrapper>
        )}

        {case_.status === 'draft' && (
          <AnimatedWrapper animation="slide" direction="up" delay={400} trigger="intersection">
            <div className="action-section" role="group" aria-label={t('caseDetail.actionSectionLabel')}>
              <Button
                type="primary"
                size="large"
                icon={<CheckCircleOutlined />}
                onClick={handleSubmit}
                loading={submitting}
                aria-label={t('caseDetail.submitCaseAria')}
                aria-describedby="submit-hint"
              >
                {t('caseDetail.submitCase')}
              </Button>
              <Text id="submit-hint" type="secondary" style={{ display: 'block', marginTop: 8 }}>
                {t('caseDetail.submitHint')}
              </Text>
            </div>
          </AnimatedWrapper>
        )}

        {(case_.status === 'submitted' || case_.status === 'in_progress') && (
          <AnimatedWrapper animation="slide" direction="up" delay={400} trigger="intersection">
            <div className="action-section" role="group" aria-label={t('caseDetail.actionSectionLabel')}>
              <Button
                type="primary"
                size="large"
                icon={<ClockCircleOutlined />}
                onClick={() => navigate(`/case/${id}/review`)}
                aria-label={t('caseDetail.viewReviewAria')}
              >
                {t('caseDetail.viewReview')}
              </Button>
            </div>
          </AnimatedWrapper>
        )}

        {case_.status === 'completed' && (
          <AnimatedWrapper animation="slide" direction="up" delay={400} trigger="intersection">
            <div className="action-section" role="group" aria-label={t('caseDetail.actionSectionLabel')}>
              <Button
                type="primary"
                size="large"
                onClick={async () => {
                  try {
                    const { getJudgmentByCaseId } = await import('@/services/api/judgment');
                    const judgment = await getJudgmentByCaseId(case_.id);
                    if (judgment) {
                      navigate(`/judgment/${judgment.id}`);
                    } else {
                      message.warning(t('message.judgmentNotReady'));
                    }
                  } catch {
                    message.error(t('message.getJudgmentFail'));
                  }
                }}
                aria-label={t('caseDetail.viewJudgmentAria')}
              >
                {t('caseDetail.viewJudgment')}
              </Button>
            </div>
          </AnimatedWrapper>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default CaseDetail;

