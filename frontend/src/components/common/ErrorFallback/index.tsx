/**
 * 錯誤回退組件
 */

import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { HomeOutlined, ReloadOutlined } from '@ant-design/icons';
import { t } from '@/utils/i18n';
import './ErrorFallback.less';

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

const ErrorFallback = ({ error, resetError }: ErrorFallbackProps) => {
  const navigate = useNavigate();
  const isDev = import.meta.env.DEV;

  const handleGoHome = () => {
    navigate('/');
    if (resetError) {
      resetError();
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  const fallbackMsg = t('error.appCrash') || '應用程序出現了問題，請稍後再試。';

  return (
    <div className="error-fallback">
      <Result
        status="error"
        title={t('error.occurred') || '發生錯誤'}
        subTitle={isDev ? (error?.message || fallbackMsg) : fallbackMsg}
        extra={[
          <Button type="primary" key="home" icon={<HomeOutlined />} onClick={handleGoHome}>
            {t('common.backHome') || '返回首頁'}
          </Button>,
          <Button key="reload" icon={<ReloadOutlined />} onClick={handleReload}>
            {t('common.reload') || '重新載入'}
          </Button>,
        ]}
      />
    </div>
  );
};

export default ErrorFallback;

