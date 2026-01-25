/**
 * 網絡狀態監控組件
 */

import { useEffect, useState } from 'react';
import { Alert } from 'antd';
import { DisconnectOutlined } from '@ant-design/icons';
import './NetworkStatus.less';

const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setWasOffline(false);
        // 可以觸發數據刷新
        window.location.reload();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  if (isOnline) {
    return null;
  }

  return (
    <div className="network-status">
      <Alert
        message="網絡連接已斷開"
        description="請檢查您的網絡連接，應用程序將在連接恢復後自動刷新。"
        type="warning"
        icon={<DisconnectOutlined />}
        showIcon
        closable={false}
      />
    </div>
  );
};

export default NetworkStatus;

