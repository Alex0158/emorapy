/**
 * 完整模式案件創建頁面
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/utils/logger';
import {
  Card,
  Button,
  Form,
  Input,
  Space,
  Typography,
  message,
  Alert,
  Radio,
  Spin,
} from 'antd';
import {
  InfoCircleOutlined,
  HeartOutlined,
} from '@ant-design/icons';
import { getPairingStatus } from '@/services/api/pairing';
import { createCase } from '@/services/api/case';
import { psychProfileApi } from '@/services/api/psychProfile';
import { validateStatement } from '@/utils/validate';
import { useInterviewTrigger } from '@/hooks/useInterviewTrigger';
import BearJudge from '@/components/business/BearJudge';
import StatementInput from '@/components/business/StatementInput';
import ConsentModal from '@/components/business/Interview/ConsentModal';
import type { UploadFile } from 'antd/es/upload/interface';
import FileUpload from '@/components/business/FileUpload';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { t } from '@/utils/i18n';
import './Create.less';

const { Title, Text, Paragraph } = Typography;

const PRE_CASE_RICHNESS_THRESHOLD = 0.3;

const CaseCreate = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [pairingStatus, setPairingStatus] = useState<'loading' | 'pending' | 'active'>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [plaintiffStatement, setPlaintiffStatement] = useState('');
  const [defendantStatement, setDefendantStatement] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<UploadFile[]>([]);
  const [mode, setMode] = useState<'remote' | 'collaborative'>('remote');

  const [showPreCaseBanner, setShowPreCaseBanner] = useState(false);
  const {
    triggerInterview: handlePreCaseChat,
    consentOpen,
    setConsentOpen,
    setProfileConsent,
    handleConsent,
    consentLoading,
  } = useInterviewTrigger('pre_case');

  useEffect(() => {
    let cancelled = false;
    const checkPairing = async () => {
      try {
        const pairing = await getPairingStatus();
        if (cancelled) return;
        if (pairing && pairing.status === 'active') {
          setPairingId(pairing.id);
          setPairingStatus('active');
        } else {
          setPairingStatus('pending');
        }
      } catch {
        if (!cancelled) setPairingStatus('pending');
      }
    };
    checkPairing();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    psychProfileApi.getProfile()
      .then((res) => {
        if (cancelled) return;
        const profile = res.data?.data;
        if (!profile) return;
        setProfileConsent(!!profile.consent_given);
        const richness = profile.richness_score ?? 0;
        if (richness < PRE_CASE_RICHNESS_THRESHOLD) {
          setShowPreCaseBanner(true);
        }
      })
      .catch((e: unknown) => { logger.warn('Failed to fetch profile for pre-case banner', e); });
    return () => { cancelled = true; };
  }, [setProfileConsent]);

  const plaintiffValid = validateStatement(plaintiffStatement).valid;
  const defendantValid = validateStatement(defendantStatement).valid;
  const isRemote = mode === 'remote';
  const canSubmit = isRemote
    ? plaintiffValid && pairingStatus === 'active'
    : plaintiffValid && defendantValid && pairingStatus === 'active';

  type CreateCaseFormValues = { title?: string };
  const handleSubmit = async (values: CreateCaseFormValues) => {
    if (submitting) return;
    if (!pairingId) {
      message.error(t('message.pairingRequired'));
      navigate('/profile/pairing');
      return;
    }

    if (!canSubmit) {
      message.warning(isRemote ? t('caseCreate.plaintiffStatementRequired') : t('message.completeBothStatements'));
      return;
    }

    setSubmitting(true);
    try {
      const caseData: Parameters<typeof createCase>[0] = {
        pairing_id: pairingId,
        title: values.title,
        plaintiff_statement: plaintiffStatement,
        mode,
        evidence_urls: [],
      };
      if (!isRemote && defendantStatement) {
        caseData.defendant_statement = defendantStatement;
      }

      const newCase = await createCase(caseData);
      message.success(
        isRemote
          ? t('caseCreate.remoteCreateSuccess')
          : t('message.createCaseSuccess')
      );

      const filesToUpload: File[] = evidenceFiles
        .filter((f): f is UploadFile<File> & { originFileObj: File } => Boolean(f.originFileObj))
        .map((f) => f.originFileObj);

      if (filesToUpload.length > 0) {
        try {
          const { uploadEvidence } = await import('@/services/api/case');
          await uploadEvidence(newCase.id, filesToUpload);
          message.success(t('message.evidenceUploadSuccess'));
        } catch (uploadError: unknown) {
          const uerr = uploadError as { message?: string };
          message.warning(uerr?.message || t('message.evidenceUploadFailCaseCreated'));
        }
      }

      navigate(`/case/${newCase.id}`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      message.error(err?.message || t('message.createCaseFail'));
    } finally {
      setSubmitting(false);
    }
  };

  if (pairingStatus === 'loading') {
    return (
      <div className="case-create-page">
        <Spin size="large" />
      </div>
    );
  }

  if (pairingStatus === 'pending') {
    return (
      <div className="case-create-page">
        <Card>
          <Alert
            message={t('caseCreate.pairingRequired')}
            description={t('caseCreate.pairingDesc')}
            type="warning"
            showIcon
            action={
              <Button type="primary" onClick={() => navigate('/profile/pairing')}>
                {t('caseCreate.goPairing')}
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={t('caseCreate.title')}
        description={t('caseCreate.description')}
        keywords={t('caseCreate.keywords')}
      />
      <div className="case-create-page" role="main" aria-label={t('caseCreate.pageLabel')}>
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header" aria-labelledby="create-title">
            <BearJudge size="medium" animated />
            <Title level={2} id="create-title">{t('caseCreate.heading')}</Title>
            <Paragraph type="secondary">{t('caseCreate.subtitle')}</Paragraph>
          </div>
        </AnimatedWrapper>

        {showPreCaseBanner && (
          <AnimatedWrapper animation="slide" direction="up" delay={150}>
            <Alert
              message={t('trigger.preCaseTitle')}
              description={t('trigger.preCaseDesc')}
              type="info"
              showIcon
              icon={<HeartOutlined />}
              closable
              onClose={() => setShowPreCaseBanner(false)}
              action={
                <Space direction="vertical" size="small">
                  <Button size="small" type="primary" onClick={handlePreCaseChat}>
                    {t('trigger.preCaseOk')}
                  </Button>
                  <Button size="small" onClick={() => setShowPreCaseBanner(false)}>
                    {t('trigger.preCaseSkip')}
                  </Button>
                </Space>
              }
              style={{ marginBottom: 16 }}
            />
          </AnimatedWrapper>
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="case-create-form"
          aria-label={t('caseCreate.formLabel')}
        >
          <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
            <Card title={t('caseCreate.basicInfo')} className="form-section">
            <Form.Item
              name="title"
              label={t('caseCreate.caseTitle')}
            >
              <Input placeholder={t('caseCreate.caseTitlePlaceholder')} maxLength={200} />
            </Form.Item>

            <Alert
              message={t('caseCreate.aiAutoDetectHint')}
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
              style={{ marginBottom: 16 }}
            />

            <Form.Item
              label={t('caseCreate.mode')}
            >
              <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
                <Space direction="vertical">
                  <Radio value="remote">
                    <span>{t('caseCreate.modeRemoteLabel')}</span>
                    <Text type="secondary" style={{ display: 'block', marginLeft: 22, fontSize: 12 }}>
                      {t('caseCreate.modeRemoteDesc')}
                    </Text>
                  </Radio>
                  <Radio value="collaborative">
                    <span>{t('caseCreate.modeCollaborativeLabel')}</span>
                    <Text type="secondary" style={{ display: 'block', marginLeft: 22, fontSize: 12 }}>
                      {t('caseCreate.modeCollaborativeDesc')}
                    </Text>
                  </Radio>
                </Space>
              </Radio.Group>
            </Form.Item>
            </Card>
          </AnimatedWrapper>

          <AnimatedWrapper animation="slide" direction="up" delay={250} trigger="intersection">
            <Card
              title={isRemote ? t('caseCreate.plaintiffStatementTitle') : t('caseCreate.statements')}
              className="form-section"
            >
            <div className="statements-section">
              <div className="statement-item">
                {!isRemote && <Title level={4}>{t('caseDetail.plaintiffStatement')}</Title>}
                <StatementInput
                  value={plaintiffStatement}
                  onChange={setPlaintiffStatement}
                  placeholder={t('caseCreate.plaintiffPlaceholder')}
                />
              </div>

              {!isRemote && (
                <div className="statement-item">
                  <Title level={4}>{t('caseDetail.defendantStatement')}</Title>
                  <StatementInput
                    value={defendantStatement}
                    onChange={setDefendantStatement}
                    placeholder={t('caseCreate.defendantPlaceholder')}
                  />
                </div>
              )}

              {isRemote && (
                <Alert
                  message={t('caseCreate.remoteFlowHint')}
                  type="info"
                  showIcon
                  style={{ marginTop: 12 }}
                />
              )}
            </div>
            </Card>
          </AnimatedWrapper>

          <AnimatedWrapper animation="slide" direction="up" delay={300} trigger="intersection">
            <Card
              title={t('caseCreate.evidenceTitle')}
              className="form-section"
              extra={<Text type="secondary">{t('caseCreate.evidenceExtra')}</Text>}
            >
            <FileUpload
              value={evidenceFiles}
              onChange={setEvidenceFiles}
              maxCount={3}
            />
            </Card>
          </AnimatedWrapper>

          <AnimatedWrapper animation="slide" direction="up" delay={350} trigger="intersection">
            <div className="submit-section">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={submitting}
                disabled={!canSubmit}
              >
                {submitting ? t('caseCreate.creating') : t('caseCreate.submitBtn')}
              </Button>
              <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
                {t('caseCreate.submitHint')}
              </Text>
            </Space>
            </div>
          </AnimatedWrapper>
        </Form>

        <ConsentModal
          open={consentOpen}
          onConsent={handleConsent}
          onCancel={() => setConsentOpen(false)}
          loading={consentLoading}
        />
      </div>
    </>
  );
};

export default CaseCreate;

