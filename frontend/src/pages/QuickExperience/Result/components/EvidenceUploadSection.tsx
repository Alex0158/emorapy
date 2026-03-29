import { Alert, Space, Typography, Upload } from 'antd';
import { ExclamationCircleOutlined, UploadOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { MAX_IMAGE_COUNT } from '@/utils/constants';
import { t } from '@/utils/i18n';
import { useState } from 'react';

const { Title, Text } = Typography;

type Props = {
  status: 'success' | 'failed' | 'pending' | null;
  caseId: string;
  isUploading: boolean;
  onUploadFiles: (files: File[]) => void;
};

const EvidenceUploadSection = ({ status, caseId, isUploading, onUploadFiles }: Props) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  if (!caseId || !status || status === 'success') return null;

  return (
    <AnimatedWrapper animation="slide" direction="up" delay={450} trigger="intersection">
      <section className="evidence-upload-section" aria-labelledby="evidence-upload-title" style={{ padding: '0 0 40px' }}>
        <div className="container">
          <div className="premium-card" style={{ padding: '32px' }}>
            <Space orientation="vertical" size="large" style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {status === 'failed' ? (
                  <ExclamationCircleOutlined style={{ color: '#EF4444', fontSize: 28, filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.5))' }} />
                ) : (
                  <CloudUploadOutlined style={{ color: '#F59E0B', fontSize: 28, filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.5))' }} />
                )}
                <Title level={3} id="evidence-upload-title" style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
                  {t('evidence.title')}
                </Title>
              </div>
              
              {status === 'failed' && (
                <Alert
                  description={<span style={{ color: '#FDE68A' }}>{t('evidence.failed.desc')}</span>}
                  type="warning"
                  showIcon
                  style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 16,
                  }}
                  title={<span style={{ color: '#FCD34D', fontWeight: 600 }}>{t('evidence.failed')}</span>}
                />
              )}
              
              {status === 'pending' && (
                <Alert
                  description={<span style={{ color: '#BAE6FD' }}>{t('evidence.pending.desc')}</span>}
                  type="info"
                  showIcon
                  style={{
                    background: 'rgba(14, 165, 233, 0.1)',
                    border: '1px solid rgba(14, 165, 233, 0.3)',
                    borderRadius: 16,
                  }}
                  title={<span style={{ color: '#7DD3FC', fontWeight: 600 }}>{t('evidence.pending')}</span>}
                />
              )}
              
              <Upload
                multiple
                maxCount={MAX_IMAGE_COUNT}
                beforeUpload={() => false}
                onChange={(info) => {
                  const fileList = info.fileList.map((f) => f.originFileObj).filter(Boolean) as File[];
                  setSelectedFiles(fileList);
                }}
                accept="image/*,video/*"
                disabled={isUploading}
              >
                <button 
                  className="action-button secondary" 
                  disabled={isUploading}
                  style={{ height: 48, borderRadius: 24, padding: '0 24px', fontSize: 15, cursor: isUploading ? 'not-allowed' : 'pointer' }}
                >
                  <UploadOutlined style={{ marginRight: 8 }} />
                  {t('evidence.action.reupload')}
                </button>
              </Upload>
              
              {selectedFiles.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Space style={{ marginTop: 8 }}>
                    <Text style={{ color: '#94A3B8' }}>
                      {t('evidence.selectedCount').replace('{count}', String(selectedFiles.length))}
                    </Text>
                    <button
                      className="action-button primary"
                      disabled={isUploading}
                      onClick={() => {
                        if (selectedFiles.length > 0) {
                          onUploadFiles(selectedFiles);
                          setSelectedFiles([]);
                        }
                      }}
                      style={{ height: 40, borderRadius: 20, padding: '0 24px', fontSize: 14, cursor: isUploading ? 'not-allowed' : 'pointer' }}
                    >
                      {isUploading ? t('evidence.action.uploading') : t('evidence.action.uploadSelected')}
                    </button>
                    <button 
                      className="action-button secondary" 
                      disabled={isUploading} 
                      onClick={() => setSelectedFiles([])}
                      style={{ height: 40, borderRadius: 20, padding: '0 24px', fontSize: 14, cursor: isUploading ? 'not-allowed' : 'pointer', background: 'transparent' }}
                    >
                      {t('common.clear')}
                    </button>
                  </Space>
                </motion.div>
              )}
            </Space>
          </div>
        </div>
      </section>
    </AnimatedWrapper>
  );
};

export default EvidenceUploadSection;
