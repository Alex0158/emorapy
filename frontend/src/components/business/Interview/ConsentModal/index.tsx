import React from 'react';
import { Modal, Typography, Space, Button, Checkbox } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import { t } from '@/utils/i18n';
import './index.less';

const { Title, Paragraph, Text } = Typography;

interface ConsentModalProps {
  open: boolean;
  onConsent: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const ConsentModal: React.FC<ConsentModalProps> = ({ open, onConsent, onCancel, loading }) => {
  const [agreed, setAgreed] = React.useState(false);

  React.useEffect(() => {
    if (!open) setAgreed(false);
  }, [open]);

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={520}
      className="consent-modal"
      closable
    >
      <div className="consent-modal__content">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div className="consent-modal__header">
            <SafetyOutlined style={{ fontSize: 32, color: '#52c41a' }} />
            <Title level={4} style={{ margin: 0 }}>{t('consent.beforeStart')}</Title>
          </div>

          <Paragraph>{t('consent.description')}</Paragraph>

          <div className="consent-modal__points">
            <Paragraph>
              <Text strong>{t('consent.promise')}</Text>
            </Paragraph>
            <ul>
              <li>{t('consent.point1')}</li>
              <li>{t('consent.point2')}</li>
              <li>{t('consent.point3')}</li>
              <li>{t('consent.point4')}</li>
              <li>{t('consent.point5')}</li>
            </ul>
          </div>

          <Checkbox
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          >
            {t('consent.agree')}
          </Checkbox>

          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onCancel}>{t('consent.notNow')}</Button>
            <Button
              type="primary"
              onClick={onConsent}
              disabled={!agreed || loading}
              loading={loading}
            >
              {t('consent.start')}
            </Button>
          </Space>
        </Space>
      </div>
    </Modal>
  );
};

export default ConsentModal;
