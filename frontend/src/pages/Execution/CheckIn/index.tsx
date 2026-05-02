/**
 * 今天的一小步
 */

import { useEffect, useRef, useState } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Radio,
  Space,
  Spin,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  UploadOutlined,
} from '@ant-design/icons';
import { AnimatePresence, motion } from 'framer-motion';
import { checkin, getExecutionStatus, type ExecutionStatus } from '@/services/api/execution';
import { uploadEvidence } from '@/services/api/case';
import { getPlanById } from '@/services/api/reconciliation';
import type { FormInstance } from 'antd';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import './CheckIn.less';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface ExecutionCheckInProps {
  formRef?: React.MutableRefObject<FormInstance | null>;
}

const normalizeExecutionStatus = (payload: ExecutionStatus): ExecutionStatus => ({
  ...payload,
  records: Array.isArray(payload.records) ? payload.records : [],
  recent_checkins: Array.isArray(payload.recent_checkins) ? payload.recent_checkins : [],
});

const ExecutionCheckIn = ({ formRef }: ExecutionCheckInProps) => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const mountedRef = useMountedRef();
  const [form] = Form.useForm();
  const [execution, setExecution] = useState<ExecutionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleRef = useRef(false);

  useEffect(() => {
    if (formRef) formRef.current = form;
    return () => {
      if (formRef) formRef.current = null;
    };
  }, [form, formRef]);

  useEffect(() => {
    staleRef.current = false;
    if (planId) {
      void fetchExecution();
    }
    return () => {
      staleRef.current = true;
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const fetchExecution = async () => {
    if (!planId) return;
    setLoading(true);
    try {
      const data = await getExecutionStatus(planId);
      if (staleRef.current) return;
      setExecution(normalizeExecutionStatus(data));
      form.setFieldsValue({
        step_result: 'done',
        closeness: 'same',
        stress: 'medium',
        needs_help: false,
      });
    } catch (error: unknown) {
      if (!staleRef.current) {
        message.error(getErrorMessage(error, 'message.getExecutionStatusFail'));
        setExecution(null);
      }
    } finally {
      if (!staleRef.current) setLoading(false);
    }
  };

  type CheckInFormValues = {
    step_result: 'done' | 'partial' | 'skipped';
    closeness: 'closer' | 'same' | 'farther';
    stress: 'low' | 'medium' | 'high';
    needs_help: boolean;
    notes?: string;
    photos?: Array<{ originFileObj?: File }> | { fileList?: Array<{ originFileObj?: File }> };
  };

  const handleSubmit = async (values: CheckInFormValues) => {
    if (!planId || submitting) return;
    setSubmitting(true);
    try {
      let photoUrls: string[] = [];
      const rawPhotos = values.photos;
      const photoList = Array.isArray(rawPhotos) ? rawPhotos : rawPhotos?.fileList ?? [];
      const photoFiles = photoList.filter((file) => file?.originFileObj);

      if (photoFiles.length > 0) {
        setUploadingPhotos(true);
        try {
          const plan = await getPlanById(planId);
          if (plan?.judgment?.case_id) {
            const files = photoFiles.map((file) => file.originFileObj as File);
            const evidences = await uploadEvidence(plan.judgment.case_id, files);
            photoUrls = evidences.map((item) => item.file_url);
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
        step_result: values.step_result,
        closeness: values.closeness,
        stress: values.stress,
        needs_help: values.needs_help,
      });

      if (!mountedRef.current) return;
      setShowSuccessAnim(true);
      successTimeoutRef.current = setTimeout(() => {
        successTimeoutRef.current = null;
        if (!mountedRef.current) return;
        setShowSuccessAnim(false);
        message.success(values.needs_help ? '已記下你的狀態，我們之後會幫你降一點難度。' : t('message.checkinSuccess'));
        form.resetFields();
        void fetchExecution();
      }, 1500);
    } catch (error: unknown) {
      if (mountedRef.current) {
        message.error(getErrorMessage(error, 'message.checkinFail'));
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="execution-checkin-page">
        <Form form={form} component={false} />
        <Spin size="large" description={t('common.loading')} />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="execution-checkin-page">
        <Form form={form} component={false} />
        <Alert
          type="warning"
          title={t('execCheckIn.notFound')}
          action={(
            <Space>
              <Button size="small" onClick={() => fetchExecution()}>{t('common.retry')}</Button>
              <Button size="small" type="primary" onClick={() => navigate('/execution/dashboard')}>
                {t('execCheckIn.backToDashboard')}
              </Button>
            </Space>
          )}
        />
      </div>
    );
  }

  const recentCheckins = Array.isArray(execution.recent_checkins) ? execution.recent_checkins : [];

  return (
    <ProtectedRoute>
      <SEO title={t('execCheckIn.title')} description={t('execCheckIn.description')} />
      <div className="execution-checkin-page" role="main" aria-label={t('execCheckIn.pageLabel')}>
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header" aria-labelledby="checkin-title">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} aria-label={t('execCheckIn.backAria')}>
              {t('execCheckIn.back')}
            </Button>
            <Title level={2} id="checkin-title">{t('execCheckIn.heading')}</Title>
          </div>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="down" delay={180}>
          <Card style={{ marginBottom: 24 }}>
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Text strong>{execution.plan_summary?.title || '今天的一小步'}</Text>
              <Text type="secondary">
                {execution.relationship_mode === 'co' ? '你們正在一起修復' : '目前由你先開始，這也沒關係'}
              </Text>
              {execution.journey_status === 'replanning' ? (
                <Alert
                  type="warning"
                  showIcon
                  message="這一輪需要先重新調整"
                  description="最近的回饋顯示目前這一步太吃力了，先把它調成更可承受的版本。"
                  action={(
                    <Button size="small" type="primary" onClick={() => navigate(`/execution/${planId}/replan`)}>
                      去調整這一輪
                    </Button>
                  )}
                />
              ) : null}
              {execution.journey_status === 'paused' ? (
                <Alert
                  type="info"
                  showIcon
                  message="這一輪目前暫停中"
                  description="你可以先回到方案工作台，再決定要不要恢復這一輪。"
                  action={(
                    <Button size="small" onClick={() => navigate('/execution/dashboard')}>
                      回到修復進展
                    </Button>
                  )}
                />
              ) : null}
              {execution.current_step && (
                <div>
                  <Text strong>今天做什麼</Text>
                  <Paragraph className="mt-2 mb-2">{execution.current_step.content}</Paragraph>
                  {execution.current_step.fallback_content ? (
                    <Alert
                      type="info"
                      showIcon
                      title="如果今天太難"
                      description={execution.current_step.fallback_content}
                    />
                  ) : null}
                </div>
              )}
              {execution.current_step?.pause_rule ? (
                <Text type="secondary">如果不舒服時怎麼暫停：{execution.current_step.pause_rule}</Text>
              ) : null}
            </Space>
          </Card>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={260}>
          <Card>
            <Form form={form} layout="vertical" onFinish={handleSubmit} aria-label={t('execCheckIn.formLabel')}>
              <Form.Item name="step_result" label="今天有做到嗎" rules={[{ required: true, message: '請先選一個狀態' }]}>
                <Radio.Group optionType="button" buttonStyle="solid">
                  <Radio.Button value="done">完全做到</Radio.Button>
                  <Radio.Button value="partial">做了一部分</Radio.Button>
                  <Radio.Button value="skipped">今天先沒做到</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item name="closeness" label="做完後你覺得距離感怎麼樣" rules={[{ required: true, message: '請先選一個感受' }]}>
                <Radio.Group optionType="button" buttonStyle="solid">
                  <Radio.Button value="closer">更近一點</Radio.Button>
                  <Radio.Button value="same">差不多</Radio.Button>
                  <Radio.Button value="farther">反而更遠</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item name="stress" label="這一步帶來的壓力感" rules={[{ required: true, message: '請先選一個壓力程度' }]}>
                <Radio.Group optionType="button" buttonStyle="solid">
                  <Radio.Button value="low">低</Radio.Button>
                  <Radio.Button value="medium">中</Radio.Button>
                  <Radio.Button value="high">高</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item name="needs_help" label="要不要下一次換一個更低壓版本？">
                <Radio.Group>
                  <Radio value={false}>先不用，我還可以再試一次</Radio>
                  <Radio value={true}>要，幫我降一點難度</Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item name="notes" label={t('execCheckIn.notesLabel')}>
                <TextArea
                  rows={4}
                  placeholder="如果你想記下剛才發生了什麼、哪裡卡住、哪一句話特別有感覺，可以寫在這裡。"
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
                <Upload listType="picture-card" maxCount={3} beforeUpload={() => false}>
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
                      <motion.div key="normal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {uploadingPhotos ? t('execCheckIn.uploadingPhotos') : '記下今天的一小步'}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </AnimatedWrapper>

        {recentCheckins.length > 0 && (
          <AnimatedWrapper animation="slide" direction="up" delay={340}>
            <Card title={t('execCheckIn.historyTitle')} style={{ marginTop: 24 }}>
              <Space orientation="vertical" style={{ width: '100%' }}>
                {recentCheckins.map((item) => (
                  <Card key={item.id} size="small">
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      <Text strong>
                        {item.result === 'done' ? '完全做到' : item.result === 'partial' ? '做了一部分' : '今天先沒做到'}
                      </Text>
                      <Text type="secondary">
                        距離感：{item.closeness} / 壓力：{item.stress} / {item.needs_help ? '需要更低壓版本' : '暫時不用調整'}
                      </Text>
                      {item.notes ? <Paragraph className="mb-0">{item.notes}</Paragraph> : null}
                      <Text type="secondary">{new Date(item.created_at).toLocaleString()}</Text>
                    </Space>
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
