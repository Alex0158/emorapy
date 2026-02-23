import React from 'react';
import { Alert, Typography, Space } from 'antd';
import { HeartOutlined, PhoneOutlined } from '@ant-design/icons';
import { t } from '@/utils/i18n';
import './index.less';

const { Text, Link } = Typography;

interface SafetyAlertProps {
  message: string;
  severity?: 'info' | 'warning' | 'critical';
  onDismiss?: () => void;
}

const CRISIS_RESOURCES = [
  { nameKey: 'safety.crisis.peaceLine' as const, phone: '1925' },
  { nameKey: 'safety.crisis.lifeLine' as const, phone: '1995' },
  { nameKey: 'safety.crisis.teacherLine' as const, phone: '1980' },
];

const SafetyAlert: React.FC<SafetyAlertProps> = ({ message: alertMessage, severity = 'info', onDismiss }) => {
  const typeMap = { info: 'info', warning: 'warning', critical: 'error' } as const;
  const isCritical = severity === 'critical';

  return (
    <div className="safety-alert">
      <Alert
        type={typeMap[severity] || 'info'}
        showIcon
        icon={<HeartOutlined />}
        message={
          <Text strong>{t('safety.title')}</Text>
        }
        description={
          <Space direction="vertical" size="small">
            <Text>{alertMessage}</Text>
            {isCritical && (
              <div className="safety-alert__resources">
                <Text type="secondary">{t('safety.resources')}：</Text>
                {CRISIS_RESOURCES.map((r) => (
                  <Space key={r.phone} size={4}>
                    <PhoneOutlined />
                    <Link href={`tel:${r.phone}`}>{t(r.nameKey)} {r.phone}</Link>
                  </Space>
                ))}
              </div>
            )}
          </Space>
        }
        closable={!!onDismiss}
        onClose={onDismiss}
      />
    </div>
  );
};

export default SafetyAlert;
