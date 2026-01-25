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
  }, [planId]);

  const fetchExecution = async () => {
    setLoading(true);
    try {
      const executionData = await getExecutionStatus(planId!);
      setExecution(executionData);
    } catch (error: any) {
      message.error(error.message || '獲取執行狀態失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    if (!planId) return;
    setSubmitting(true);
    try {
      // 如果有照片文件，先上傳獲取URL
      let photoUrls: string[] = [];
      const photoFiles = values.photos?.fileList?.filter((file: any) => file.originFileObj) || [];
      
      if (photoFiles.length > 0) {
        setUploadingPhotos(true);
        try {
          // 通過planId獲取plan詳情（包含caseId）
          const { getPlanById } = await import('@/services/api/reconciliation');
          const plan = await getPlanById(planId);
          if (plan && (plan as any).judgment && (plan as any).judgment.case_id) {
            const caseId = (plan as any).judgment.case_id;
            // 上傳照片
            const files = photoFiles.map((file: any) => file.originFileObj as File);
            const evidences = await uploadEvidence(caseId, files);
            photoUrls = evidences.map(e => e.file_url);
          }
        } catch (uploadError: any) {
          message.warning('照片上傳失敗，但可以繼續提交打卡');
        } finally {
          setUploadingPhotos(false);
        }
      }

      await checkin({
        plan_id: planId,
        notes: values.notes,
        photos: photoUrls,
      });
      message.success('打卡成功！');
      form.resetFields();
      fetchExecution();
    } catch (error: any) {
      message.error(error.message || '打卡失敗');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="execution-checkin-page">
        <Spin size="large" tip="加載中..." />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <SEO
        title="執行打卡 - 熊媽媽法庭"
        description="記錄和好方案的執行情況"
      />
      <div className="execution-checkin-page" role="main" aria-label="執行打卡頁面">
        <AnimatedWrapper animation="fade" delay={100}>
          <div className="page-header" aria-labelledby="checkin-title">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
              aria-label="返回上一頁"
            >
              返回
            </Button>
            <Title level={2} id="checkin-title">
              執行打卡
            </Title>
          </div>
        </AnimatedWrapper>

        {execution && (
          <AnimatedWrapper animation="slide" direction="down" delay={200} trigger="intersection">
            <Card style={{ marginBottom: 24 }} role="status" aria-live="polite">
              <Space direction="vertical">
                <Text strong>執行進度：{execution.progress}%</Text>
                <Text type="secondary">已記錄 {execution.records.length} 次打卡</Text>
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
              aria-label="執行打卡表單"
            >
            <Form.Item
              name="notes"
              label="執行感受"
              rules={[{ required: true, message: '請填寫執行感受' }]}
            >
              <TextArea
                rows={6}
                placeholder="請描述您執行方案的情況、感受和收穫..."
                maxLength={1000}
                showCount
              />
            </Form.Item>

            <Form.Item
              name="photos"
              label="上傳照片（可選）"
            >
              <Upload
                listType="picture-card"
                maxCount={3}
                beforeUpload={() => false}
              >
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>上傳</div>
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
                {uploadingPhotos ? '正在上傳照片...' : '提交打卡'}
              </Button>
            </Form.Item>
          </Form>
          </Card>
        </AnimatedWrapper>

        {execution && execution.records.length > 0 && (
          <AnimatedWrapper animation="slide" direction="up" delay={400} trigger="intersection">
            <Card title="歷史記錄" style={{ marginTop: 24 }}>
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

