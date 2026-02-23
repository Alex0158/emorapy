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

  const fallbackMsg = t('error.appCrash');

  return (
    <div className="error-fallback">
      <Result
        status="error"
        title={t('error.occurred')}
        subTitle={isDev ? (error?.message || fallbackMsg) : fallbackMsg}
        extra={[
          <Button type="primary" key="home" icon={<HomeOutlined />} onClick={handleGoHome}>
            {t('common.backHome')}
          </Button>,
          <Button key="reload" icon={<ReloadOutlined />} onClick={handleReload}>
            {t('common.reload')}
          </Button>,
        ]}
      />
    </div>
  );
};

export default ErrorFallback;

