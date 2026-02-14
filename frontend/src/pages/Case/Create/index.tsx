/**
 * 完整模式案件創建頁面
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Form,
  Input,
  Select,
  Space,
  Typography,
  message,
  Alert,
  Radio,
} from 'antd';
import {
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useCaseStore } from '@/store/caseStore';
import { getPairingStatus } from '@/services/api/pairing';
import { createCase } from '@/services/api/case';
import { validateStatement } from '@/utils/validate';
import BearJudge from '@/components/business/BearJudge';
import StatementInput from '@/components/business/StatementInput';
import type { UploadFile } from 'antd/es/upload/interface';
import FileUpload from '@/components/business/FileUpload';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { t } from '@/utils/i18n';
import { CASE_TYPES, CASE_TYPE_I18N_KEYS } from '@/utils/caseType';
import './Create.less';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const CaseCreate = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { isLoading } = useCaseStore();
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [pairingStatus, setPairingStatus] = useState<'pending' | 'active' | null>(null);
  const [plaintiffStatement, setPlaintiffStatement] = useState('');
  const [defendantStatement, setDefendantStatement] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<UploadFile[]>([]);
  const [mode, setMode] = useState<'remote' | 'collaborative'>('remote');

  // 檢查配對狀態
  useEffect(() => {
    const checkPairing = async () => {
      try {
        const pairing = await getPairingStatus();
        if (pairing && pairing.status === 'active') {
          setPairingId(pairing.id);
          setPairingStatus('active');
        } else {
          setPairingStatus('pending');
        }
      } catch {
        setPairingStatus('pending');
      }
    };
    checkPairing();
  }, []);

  // 驗證陳述
  const plaintiffValid = validateStatement(plaintiffStatement).valid;
  const defendantValid = validateStatement(defendantStatement).valid;
  const canSubmit = plaintiffValid && defendantValid && pairingStatus === 'active';

  type CreateCaseFormValues = { title?: string; type?: string; sub_type?: string };
  const handleSubmit = async (values: CreateCaseFormValues) => {
    if (!pairingId) {
      message.error(t('message.pairingRequired'));
      navigate('/profile/pairing');
      return;
    }

    if (!canSubmit) {
      message.warning(t('message.completeBothStatements'));
      return;
    }

    try {
      const caseData = {
        pairing_id: pairingId,
        title: values.title || t('message.untitledCase'),
        type: values.type || '其他衝突',
        sub_type: values.sub_type,
        plaintiff_statement: plaintiffStatement,
        defendant_statement: defendantStatement,
        evidence_urls: [], // 證據將在案件創建後上傳
      };

      const newCase = await createCase(caseData);
      message.success(t('message.createCaseSuccess'));

      // 如果有證據文件，上傳證據
      const filesToUpload: File[] = evidenceFiles
        .filter((f): f is UploadFile<File> & { originFileObj: File } => Boolean(f.originFileObj))
        .map((f) => f.originFileObj);

      if (filesToUpload.length > 0) {
        try {
          const { uploadEvidence } = await import('@/services/api/case');
          await uploadEvidence(newCase.id, filesToUpload);
          message.success(t('message.evidenceUploadSuccess'));
        } catch (uploadError: unknown) {
          // 證據上傳失敗不阻止流程，只提示
          const msg = uploadError instanceof Error ? uploadError.message : t('message.evidenceUploadFailCaseCreated');
          message.warning(msg);
        }
      }

      navigate(`/case/${newCase.id}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.createCaseFail');
      message.error(msg);
    }
  };

  if (pairingStatus === 'pending') {
    return (
      <ProtectedRoute>
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
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
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
              rules={[{ required: true, message: t('caseCreate.caseTitleRequired') }]}
            >
              <Input placeholder={t('caseCreate.caseTitlePlaceholder')} maxLength={200} />
            </Form.Item>

            <Form.Item
              name="type"
              label={t('caseCreate.caseType')}
              rules={[{ required: true, message: t('caseCreate.caseTypeRequired') }]}
            >
              <Select placeholder={t('caseCreate.caseTypePlaceholder')}>
                {CASE_TYPES.map((type) => (
                  <Option key={type} value={type}>
                    {t(CASE_TYPE_I18N_KEYS[type])}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="sub_type" label={t('caseCreate.subType')}>
              <Input placeholder={t('caseCreate.subTypePlaceholder')} />
            </Form.Item>

            <Form.Item
              name="mode"
              label={t('caseCreate.mode')}
              initialValue="remote"
            >
              <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
                <Radio value="remote">{t('caseCreate.modeRemoteLabel')}</Radio>
                <Radio value="collaborative">{t('caseCreate.modeCollaborativeLabel')}</Radio>
              </Radio.Group>
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                <InfoCircleOutlined /> {t('caseCreate.modeHint')}
              </Text>
            </Form.Item>
            </Card>
          </AnimatedWrapper>

          <AnimatedWrapper animation="slide" direction="up" delay={250} trigger="intersection">
            <Card title={t('caseCreate.statements')} className="form-section">
            <div className="statements-section">
              <div className="statement-item">
                <Title level={4}>{t('caseDetail.plaintiffStatement')}</Title>
                <StatementInput
                  value={plaintiffStatement}
                  onChange={setPlaintiffStatement}
                  placeholder={t('caseCreate.plaintiffPlaceholder')}
                />
              </div>

              <div className="statement-item">
                <Title level={4}>{t('caseDetail.defendantStatement')}</Title>
                <StatementInput
                  value={defendantStatement}
                  onChange={setDefendantStatement}
                  placeholder={t('caseCreate.defendantPlaceholder')}
                />
              </div>
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
                loading={isLoading}
                disabled={!canSubmit}
              >
                {isLoading ? t('caseCreate.creating') : t('caseCreate.submitBtn')}
              </Button>
              <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
                {t('caseCreate.submitHint')}
              </Text>
            </Space>
            </div>
          </AnimatedWrapper>
        </Form>
      </div>
    </ProtectedRoute>
  );
};

export default CaseCreate;

