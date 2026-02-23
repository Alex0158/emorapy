/**
 * 網絡狀態監控組件
 */

import { useEffect, useState, useRef } from 'react';
import { Alert, message } from 'antd';
import { DisconnectOutlined } from '@ant-design/icons';
import { t } from '@/utils/i18n';
import './NetworkStatus.less';

const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        message.success(t('networkStatus.restored'));
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div className="network-status">
      <Alert
        message={t('networkStatus.offline')}
        description={t('networkStatus.offlineDesc')}
        type="warning"
        icon={<DisconnectOutlined />}
        showIcon
        closable={false}
      />
    </div>
  );
};

export default NetworkStatus;

