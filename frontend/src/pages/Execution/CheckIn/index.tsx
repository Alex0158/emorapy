/**
 * 執行打卡頁面
 */

import { useState, useEffect, useRef } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
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
  Alert,
} from 'antd';
import {
  UploadOutlined,
  ArrowLeftOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import { checkin, getExecutionStatus } from '@/services/api/execution';
import { uploadEvidence } from '@/services/api/case';
import type { ExecutionStatus } from '@/services/api/execution';
import type { FormInstance } from 'antd';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { motion, AnimatePresence } from 'framer-motion';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import './CheckIn.less';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface ExecutionCheckInProps {
  /** 僅供測試使用：注入 form 實例以程式化設定表單值 */
  formRef?: React.MutableRefObject<FormInstance | null>;
}

const ExecutionCheckIn = ({ formRef }: ExecutionCheckInProps) => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  useEffect(() => {
    if (formRef) formRef.current = form;
    return () => { if (formRef) formRef.current = null; };
  }, [form, formRef]);
  const [execution, setExecution] = useState<ExecutionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);

  const mountedRef = useMountedRef();
  const submitLockRef = useRef(false);
  const retryLockRef = useRef(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleRef = useRef(false);
  useEffect(() => {
    staleRef.current = false;
    setExecution(null);
    if (planId) {
      fetchExecution();
    }
    return () => {
      staleRef.current = true;
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅在 planId 變化時拉取
  }, [planId]);

  const fetchExecution = async (opts?: { isRefresh?: boolean }) => {
    const isRefresh = opts?.isRefresh ?? false;
    if (!isRefresh) setLoading(true);
    try {
      const executionData = await getExecutionStatus(planId!);
      if (staleRef.current) return;
      setExecution(executionData);
    } catch (error: unknown) {
      if (staleRef.current) return;
      if (isRefresh && execution) {
        message.warning(t('execCheckIn.refreshFail'));
        return;
      }
      message.error(getErrorMessage(error, 'message.getExecutionStatusFail'));
      setExecution(null);
    } finally {
      if (!staleRef.current && !isRefresh) setLoading(false);
    }
  };

  type CheckInFormValues = { notes?: string; photos?: Array<{ originFileObj?: File }> | { fileList?: Array<{ originFileObj?: File }> } };
  const handleSubmit = async (values: CheckInFormValues) => {
    if (!planId || submitting || submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    let deferUnlockToSuccessAnimation = false;
    try {
      let photoUrls: string[] = [];
      const rawPhotos = values.photos;
      const photoList = Array.isArray(rawPhotos) ? rawPhotos : rawPhotos?.fileList ?? [];
      const photoFiles = photoList.filter((file) => file?.originFileObj);
      
      if (photoFiles.length > 0) {
        setUploadingPhotos(true);
        try {
          const { getPlanById } = await import('@/services/api/reconciliation');
          const plan = await getPlanById(planId);
          if (plan?.judgment?.case_id) {
            const caseId = plan.judgment.case_id;
            const files = photoFiles.map((file) => file.originFileObj as File);
            const evidences = await uploadEvidence(caseId, files);
            photoUrls = evidences.map(e => e.file_url);
          } else if (mountedRef.current) {
            message.warning(t('message.photoUploadFailContinue'));
          }
        } catch (photoErr: unknown) {
          if (mountedRef.current) {
            message.warning(getErrorMessage(photoErr, 'message.photoUploadFailContinue'));
          }
        } finally {
          if (mountedRef.current) setUploadingPhotos(false);
        }
      }

      await checkin({
        plan_id: planId,
        notes: values.notes,
        photos: photoUrls,
      });
      if (!mountedRef.current) return;

      deferUnlockToSuccessAnimation = true;
      setShowSuccessAnim(true);
      successTimeoutRef.current = setTimeout(() => {
        successTimeoutRef.current = null;
        if (mountedRef.current) {
          submitLockRef.current = false;
          setSubmitting(false);
          setShowSuccessAnim(false);
          message.success(t('message.checkinSuccess'));
          form.resetFields();
          fetchExecution({ isRefresh: true });
        }
      }, 2000);
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      message.error(getErrorMessage(error, 'message.checkinFail'));
    } finally {
      if (!deferUnlockToSuccessAnimation && mountedRef.current) {
        submitLockRef.current = false;
        setSubmitting(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="execution-checkin-page">
        <Spin size="large" description={t('common.loading')} />
      </div>
    );
  }

  if (!execution) {
    const handleRetry = () => {
      if (retryLockRef.current) return;
      retryLockRef.current = true;
      fetchExecution().finally(() => {
        retryLockRef.current = false;
      });
    };
    return (
      <div className="execution-checkin-page">
        <Alert
          type="warning"
          title={t('execCheckIn.notFound')}
          action={
            <Space>
              <Button size="small" onClick={handleRetry}>{t('common.retry')}</Button>
              <Button size="small" type="primary" onClick={() => navigate('/execution/dashboard')}>
                {t('execCheckIn.backToDashboard')}
              </Button>
            </Space>
          }
        />
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
          <AnimatedWrapper animation="slide" direction="down" delay={200}>
            <Card style={{ marginBottom: 24 }} role="status" aria-live="polite">
              <Space orientation="vertical">
                <Text strong>{t('execCheckIn.progressLabel').replace('{percent}', String(execution.progress))}</Text>
                <Text type="secondary">{t('execCheckIn.recordsCount').replace('{count}', String((Array.isArray(execution.records) ? execution.records : []).length))}</Text>
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
              valuePropName="fileList"
              getValueFromEvent={(e) => e?.fileList}
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
                className={`submit-btn ${showSuccessAnim ? 'success-state' : ''}`}
                style={{ height: 56, borderRadius: 28, fontSize: 18 }}
              >
                <AnimatePresence mode="wait">
                  {showSuccessAnim ? (
                    <motion.div
                      key="success"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="flex items-center justify-center gap-2"
                    >
                      <CheckCircleFilled className="text-2xl" /> {t('execCheckIn.successInline')}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="normal"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {uploadingPhotos ? t('execCheckIn.uploadingPhotos') : t('execCheckIn.submit')}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </Form.Item>
          </Form>
          </Card>
        </AnimatedWrapper>

        {execution && (Array.isArray(execution.records) ? execution.records : []).length > 0 && (
          <AnimatedWrapper animation="slide" direction="up" delay={400}>
            <Card title={t('execCheckIn.historyTitle')} style={{ marginTop: 24 }}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              {(Array.isArray(execution.records) ? execution.records : []).map((record) => (
                <Card key={record.id} size="small">
                  {record.notes && <Text>{record.notes}</Text>}
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
