/**
 * 執行打卡頁面
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Form,
  Input,
  Typography,
  Space,
  Upload,
  message,
  Spin,
} from 'antd';
import {
  UploadOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { checkin, getExecutionStatus } from '@/services/api/execution';
import { uploadEvidence } from '@/services/api/case';
import type { ExecutionStatus } from '@/services/api/execution';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { t } from '@/utils/i18n';
import './CheckIn.less';

const { Title, Text } = Typography;
const { TextArea } = Input;

const ExecutionCheckIn = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [execution, setExecution] = useState<ExecutionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  useEffect(() => {
    if (planId) {
      fetchExecution();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅在 planId 變化時拉取
  }, [planId]);

  const fetchExecution = async () => {
    setLoading(true);
    try {
      const executionData = await getExecutionStatus(planId!);
      setExecution(executionData);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.getExecutionStatusFail');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  type CheckInFormValues = { notes?: string; photos?: { fileList?: Array<{ originFileObj?: File }> } };
  const handleSubmit = async (values: CheckInFormValues) => {
    if (!planId) return;
    setSubmitting(true);
    try {
      // 如果有照片文件，先上傳獲取URL
      let photoUrls: string[] = [];
      const photoFiles = values.photos?.fileList?.filter((file) => file.originFileObj) || [];
      
      if (photoFiles.length > 0) {
        setUploadingPhotos(true);
        try {
          // 通過planId獲取plan詳情（包含caseId）
          const { getPlanById } = await import('@/services/api/reconciliation');
          const plan = await getPlanById(planId);
          if (plan?.judgment?.case_id) {
            const caseId = plan.judgment.case_id;
            // 上傳照片
            const files = photoFiles.map((file) => file.originFileObj as File);
            const evidences = await uploadEvidence(caseId, files);
            photoUrls = evidences.map(e => e.file_url);
          }
        } catch {
          message.warning(t('message.photoUploadFailContinue'));
        } finally {
          setUploadingPhotos(false);
        }
      }

      await checkin({
        plan_id: planId,
        notes: values.notes,
        photos: photoUrls,
      });
      message.success(t('message.checkinSuccess'));
      form.resetFields();
      fetchExecution();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.checkinFail');
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="execution-checkin-page">
        <Spin size="large" description={t('common.loading')} />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <SEO
        title={t('execCheckIn.title')}
        description={t('execCheckIn.description')}
      />
      <div className="execution-checkin-page" role="main" aria-label={t('execCheckIn.pageLabel')}>
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header" aria-labelledby="checkin-title">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
              aria-label={t('execCheckIn.backAria')}
            >
              {t('execCheckIn.back')}
            </Button>
            <Title level={2} id="checkin-title">
              {t('execCheckIn.heading')}
            </Title>
          </div>
        </AnimatedWrapper>

        {execution && (
          <AnimatedWrapper animation="slide" direction="down" delay={200} trigger="intersection">
            <Card style={{ marginBottom: 24 }} role="status" aria-live="polite">
              <Space direction="vertical">
                <Text strong>{t('execCheckIn.progressLabel').replace('{percent}', String(execution.progress))}</Text>
                <Text type="secondary">{t('execCheckIn.recordsCount').replace('{count}', String(execution.records.length))}</Text>
              </Space>
            </Card>
          </AnimatedWrapper>
        )}

        <AnimatedWrapper animation="slide" direction="up" delay={300} trigger="intersection">
          <Card role="article" aria-labelledby="checkin-form-title">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              aria-label={t('execCheckIn.formLabel')}
            >
            <Form.Item
              name="notes"
              label={t('execCheckIn.notesLabel')}
              rules={[{ required: true, message: t('execCheckIn.notesRequired') }]}
            >
              <TextArea
                rows={6}
                placeholder={t('execCheckIn.notesPlaceholder')}
                maxLength={1000}
                showCount
              />
            </Form.Item>

            <Form.Item
              name="photos"
              label={t('execCheckIn.photosLabel')}
            >
              <Upload
                listType="picture-card"
                maxCount={3}
                beforeUpload={() => false}
              >
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>{t('execCheckIn.uploadBtn')}</div>
                </div>
              </Upload>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={submitting || uploadingPhotos}
              >
                {uploadingPhotos ? t('execCheckIn.uploadingPhotos') : t('execCheckIn.submit')}
              </Button>
            </Form.Item>
          </Form>
          </Card>
        </AnimatedWrapper>

        {execution && execution.records.length > 0 && (
          <AnimatedWrapper animation="slide" direction="up" delay={400} trigger="intersection">
            <Card title={t('execCheckIn.historyTitle')} style={{ marginTop: 24 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {execution.records.map((record) => (
                <Card key={record.id} size="small">
                  <Text>{record.notes}</Text>
                  <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                    {new Date(record.created_at).toLocaleString()}
                  </Text>
                </Card>
              ))}
            </Space>
          </Card>
          </AnimatedWrapper>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default ExecutionCheckIn;

