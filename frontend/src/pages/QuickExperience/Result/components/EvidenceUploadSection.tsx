import { Alert, Button, Card, Space, Typography, Upload } from 'antd';
import { ExclamationCircleOutlined, UploadOutlined } from '@ant-design/icons';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { MAX_IMAGE_COUNT } from '@/utils/constants';
import { t } from '@/utils/i18n';

const { Title } = Typography;

type Props = {
  status: 'success' | 'failed' | 'pending' | null;
  caseId: string;
  isUploading: boolean;
  onUploadFiles: (files: File[]) => void;
};

const EvidenceUploadSection = ({ status, caseId, isUploading, onUploadFiles }: Props) => {
  if (!caseId || !status || status === 'success') return null;

  return (
    <AnimatedWrapper animation="slide" direction="up" delay={450} trigger="intersection">
      <section className="evidence-upload-section" aria-labelledby="evidence-upload-title">
        <div className="container">
          <Card>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {status === 'failed' ? (
                  <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
                ) : (
                  <UploadOutlined style={{ color: '#faad14', fontSize: 20 }} />
                )}
                <Title level={4} id="evidence-upload-title" style={{ margin: 0 }}>
                  {t('evidence.title')}
                </Title>
              </div>
              {status === 'failed' && (
                <Alert
                  message={t('evidence.failed')}
                  description={t('evidence.failed.desc')}
                  type="warning"
                  showIcon
                />
              )}
              {status === 'pending' && (
                <Alert
                  message={t('evidence.pending')}
                  description={t('evidence.pending.desc')}
                  type="info"
                  showIcon
                />
              )}
              <Upload
                multiple
                maxCount={MAX_IMAGE_COUNT}
                beforeUpload={() => false}
                onChange={(info) => {
                  const fileList = info.fileList.map((f) => f.originFileObj).filter(Boolean) as File[];
                  if (fileList.length > 0) onUploadFiles(fileList);
                }}
                accept="image/*,video/*"
                disabled={isUploading}
              >
                <Button type="primary" icon={<UploadOutlined />} loading={isUploading} disabled={isUploading}>
                  {isUploading ? t('evidence.action.uploading') : t('evidence.action.reupload')}
                </Button>
              </Upload>
            </Space>
          </Card>
        </div>
      </section>
    </AnimatedWrapper>
  );
};

export default EvidenceUploadSection;
