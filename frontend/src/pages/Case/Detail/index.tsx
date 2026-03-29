/**
 * 案件詳情頁面
 */

import { useState, useEffect, useRef } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Typography,
  Space,
  Descriptions,
  Spin,
  message,
  Alert,
} from 'antd';
import {
  EditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SendOutlined,
  ExclamationCircleOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { getCase, submitCase, updateCase } from '@/services/api/case';
import type { Case } from '@/types/case';
import { useAuthStore } from '@/store/authStore';
import StatementInput from '@/components/business/StatementInput';
import { validateStatement } from '@/utils/validate';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { formatDateTime } from '@/utils/formatDate';
import { logger } from '@/utils/logger';
import { getCaseStatusTag, getCaseTypeTag } from '@/utils/statusTags';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import './Detail.less';

const { Title, Text, Paragraph } = Typography;

const CaseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [case_, setCase_] = useState<Case | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [defendantStatement, setDefendantStatement] = useState('');
  const [respondLoading, setRespondLoading] = useState(false);
  const [loadErrorTitle, setLoadErrorTitle] = useState<string | null>(null);
  const [loadErrorDescription, setLoadErrorDescription] = useState<string | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fetchLockRef = useRef(false);
  const submitLockRef = useRef(false);
  const respondLockRef = useRef(false);
  const viewJudgmentLockRef = useRef(false);

  const mountedRef = useMountedRef();
  const staleRef = useRef(false);
  useEffect(() => {
    staleRef.current = false;
    if (id) {
      fetchCase();
    }
    return () => {
      staleRef.current = true;
      clearTimeout(redirectTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅在 id 變化時拉取，fetchCase 不進 deps
  }, [id]);

  const fetchCase = async () => {
    if (!id) {
      message.error(t('message.caseIdMissing'));
      navigate('/case/list');
      return;
    }
    if (fetchLockRef.current) return;
    fetchLockRef.current = true;
    setLoading(true);
    try {
      const caseData = await getCase(id);
      if (staleRef.current) return;
      setLoadErrorTitle(null);
      setLoadErrorDescription(null);
      setCase_(caseData);
    } catch (error: unknown) {
      if (staleRef.current) return;
      type ErrShape = { code?: string; message?: string };
      const err = error as ErrShape;
      const errorCode = err?.code;

      if (errorCode === 'NOT_FOUND' || errorCode === 'HTTP_404') {
        const errorMessage = t('common.caseNotFound');
        setLoadErrorTitle(errorMessage);
        setLoadErrorDescription(null);
        message.error(errorMessage);
        redirectTimerRef.current = setTimeout(() => navigate('/case/list'), 1500);
      } else if (errorCode === 'FORBIDDEN' || errorCode === 'HTTP_403') {
        const errorMessage = getErrorMessage(error, 'message.noPermissionViewCase');
        setLoadErrorTitle(t('message.noPermissionViewCase'));
        setLoadErrorDescription(errorMessage === t('message.noPermissionViewCase') ? null : errorMessage);
        message.error(errorMessage);
        redirectTimerRef.current = setTimeout(() => navigate('/case/list'), 1500);
      } else if (errorCode === 'UNAUTHORIZED' || errorCode === 'HTTP_401') {
        const errorMessage = t('message.pleaseLogin');
        setLoadErrorTitle(errorMessage);
        setLoadErrorDescription(null);
        message.error(errorMessage);
        redirectTimerRef.current = setTimeout(() => navigate('/auth/login'), 1500);
      } else {
        const errorMessage = getErrorMessage(error, 'common.getCaseFail');
        setLoadErrorTitle(t('common.getCaseFail'));
        setLoadErrorDescription(errorMessage === t('common.getCaseFail') ? null : errorMessage);
        message.error(errorMessage);
        logger.error('Failed to fetch case', error);
      }
    } finally {
      fetchLockRef.current = false;
      if (!staleRef.current) setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting || submitLockRef.current) return;
    if (!id) {
      message.error(t('message.caseIdMissing'));
      return;
    }
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      await submitCase(id);
      if (!mountedRef.current) return;
      message.success(t('message.submitCaseSuccess'));
      navigate(`/case/${id}/review`);
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      type ErrShape = { code?: string; message?: string };
      const err = error as ErrShape;
      const errorCode = err?.code;

      if (errorCode === 'FORBIDDEN' || errorCode === 'HTTP_403') {
        message.error(getErrorMessage(error, 'message.noPermissionSubmitCase'));
      } else {
        message.error(getErrorMessage(error, 'message.submitCaseFail'));
        if (errorCode !== 'CASE_NOT_EDITABLE' && errorCode !== 'VALIDATION_ERROR') {
          logger.error('Failed to submit case', error);
        }
      }
    } finally {
      submitLockRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handleDefendantRespond = async () => {
    if (respondLoading || respondLockRef.current) return;
    if (!id || !case_) return;

    const validation = validateStatement(defendantStatement);
    if (!validation.valid) {
      message.warning(t('caseDetail.defendantStatementTooShort'));
      return;
    }

    respondLockRef.current = true;
    setRespondLoading(true);
    try {
      const updated = await updateCase(id, { defendant_statement: defendantStatement });
      if (!mountedRef.current) return;
      setCase_(updated);
      message.success(t('caseDetail.defendantRespondSuccess'));
      if (updated.status === 'submitted') {
        navigate(`/case/${id}/review`);
      }
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      message.error(getErrorMessage(error, 'caseDetail.defendantRespondFail'));
    } finally {
      respondLockRef.current = false;
      if (mountedRef.current) setRespondLoading(false);
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
        <Alert
          title={loadErrorTitle || t('common.caseNotFound')}
          description={loadErrorDescription || undefined}
          type="error"
          action={
            <Space>
              <Button size="small" onClick={() => navigate('/case/list')}>
                {t('caseDetail.backList')}
              </Button>
              <Button size="small" type="primary" onClick={() => id && fetchCase()}>
                {t('common.retry')}
              </Button>
            </Space>
          }
        />
      </div>
    );
  }

  const modeLabel =
    case_.mode === 'remote'
      ? t('caseDetail.modeRemote')
      : case_.mode === 'collaborative'
        ? t('caseDetail.modeCollaborative')
        : t('caseDetail.modeQuick');

  const isDefendant = user?.id === case_.defendant_id;
  const isPlaintiff = user?.id === case_.plaintiff_id;
  const needsDefendantResponse =
    case_.status === 'draft' &&
    (case_.mode === 'remote' || case_.mode === 'collaborative') &&
    !case_.defendant_statement;

  return (
    <>
      <SEO
        title={`${case_.title}${t('caseDetail.titleSuffix')}`}
        description={case_.plaintiff_statement?.substring(0, 100) || ''}
      />
      <div className="case-detail-page" role="main" aria-label={t('caseDetail.pageLabel')}>
        
        {/* Adaptive Hero Section based on case status */}
        <div className={`page-hero page-hero--compact status-${case_.status}`}>
          <div className="max-w-4xl mx-auto">
            <AnimatedWrapper animation="fade" delay={100}>
              <div className="page-header flex justify-between items-center mb-6" role="navigation" aria-label={t('caseDetail.actionsLabel')}>
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate('/case/list')}
                  className="font-semibold text-gray-600 hover:text-primary"
                  aria-label={t('caseDetail.backListAria')}
                >
                  {t('caseDetail.backList')}
                </Button>
                {case_.status === 'draft' && !needsDefendantResponse && (
                  <Button
                    type="default"
                    shape="round"
                    icon={<EditOutlined />}
                    onClick={() => {
                      message.info(t('message.editComingSoon'));
                    }}
                    aria-label={t('caseDetail.editAria')}
                  >
                    {t('caseDetail.edit')}
                  </Button>
                )}
              </div>
            </AnimatedWrapper>

            <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
              <div className="case-header mb-8">
                <Space className="mb-4">
                  {getCaseStatusTag(case_.status)}
                  {getCaseTypeTag(case_.type)}
                </Space>
                <Title level={1} id="case-title" className="font-heading font-bold m-0 text-4xl text-gray-900">
                  {case_.title}
                </Title>
              </div>
            </AnimatedWrapper>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 pb-24">
          <AnimatedWrapper animation="slide" direction="up" delay={250} trigger="intersection">
            <Card className="glassmorphism-2 border-none shadow-sm rounded-3xl mb-8" aria-labelledby="case-info">
              <Descriptions column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }} style={{ marginTop: 8 }} aria-label={t('caseDetail.descLabel')}>
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
          <AnimatedWrapper animation="slide" direction="up" delay={350}>
            <Card title={t('caseDetail.defendantStatement')} style={{ marginTop: 24 }} role="article" aria-labelledby="defendant-statement-title">
              <Paragraph id="defendant-statement-title">{case_.defendant_statement}</Paragraph>
            </Card>
          </AnimatedWrapper>
        )}

        {needsDefendantResponse && isDefendant && (
          <AnimatedWrapper animation="slide" direction="up" delay={350}>
            <Card
              title={t('caseDetail.yourResponse')}
              style={{ marginTop: 24 }}
            >
              <Alert
                title={t('caseDetail.defendantResponseHint')}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <StatementInput
                value={defendantStatement}
                onChange={setDefendantStatement}
                placeholder={t('caseDetail.defendantResponsePlaceholder')}
              />
              <Button
                type="primary"
                size="large"
                icon={<SendOutlined />}
                onClick={handleDefendantRespond}
                loading={respondLoading}
                disabled={!validateStatement(defendantStatement).valid}
                style={{ marginTop: 16 }}
              >
                {t('caseDetail.submitResponse')}
              </Button>
            </Card>
          </AnimatedWrapper>
        )}

        {needsDefendantResponse && isPlaintiff && (
          <AnimatedWrapper animation="slide" direction="up" delay={350}>
            <Alert
              title={t('caseDetail.waitingForDefendant')}
              description={t('caseDetail.waitingForDefendantDesc')}
              type="warning"
              showIcon
              style={{ marginTop: 24 }}
            />
          </AnimatedWrapper>
        )}

        {case_.status === 'draft' && !needsDefendantResponse && (
          <AnimatedWrapper animation="slide" direction="up" delay={400}>
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
          <AnimatedWrapper animation="slide" direction="up" delay={400}>
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
          <AnimatedWrapper animation="slide" direction="up" delay={400}>
            <div className="action-section" role="group" aria-label={t('caseDetail.actionSectionLabel')}>
              <Button
                type="primary"
                size="large"
                onClick={async () => {
                  if (viewJudgmentLockRef.current) return;
                  viewJudgmentLockRef.current = true;
                  try {
                    const { getJudgmentByCaseId } = await import('@/services/api/judgment');
                    const judgment = await getJudgmentByCaseId(case_.id);
                    if (!mountedRef.current) return;
                    if (judgment) {
                      navigate(`/judgment/${judgment.id}`);
                    } else {
                      message.warning(t('message.judgmentNotReady'));
                    }
                  } catch (error) {
                    if (!mountedRef.current) return;
                    message.error(getErrorMessage(error, 'message.getJudgmentFail'));
                  } finally {
                    viewJudgmentLockRef.current = false;
                  }
                }}
                aria-label={t('caseDetail.viewJudgmentAria')}
              >
                {t('caseDetail.viewJudgment')}
              </Button>
            </div>
          </AnimatedWrapper>
        )}

        {case_.status === 'judgment_failed' && (
          <AnimatedWrapper animation="slide" direction="up" delay={400}>
            <Alert
              title={t('review.judgmentFailed')}
              description={case_.judgment_failure_reason || t('review.judgmentFailedDesc')}
              type="error"
              showIcon
              icon={<ExclamationCircleOutlined />}
              style={{ marginTop: 24 }}
              action={
                <Button
                  type="primary"
                  size="small"
                  onClick={() => navigate(`/case/${id}/review`)}
                >
                  {t('review.retryJudgment')}
                </Button>
              }
            />
          </AnimatedWrapper>
        )}
        </div>
      </div>
    </>
  );
};

export default CaseDetail;
