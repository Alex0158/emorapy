/**
 * 錯誤回退組件
 */

import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { HomeOutlined, ReloadOutlined } from '@ant-design/icons';
import './ErrorFallback.less';

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

const ErrorFallback = ({ error, resetError }: ErrorFallbackProps) => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
    if (resetError) {
      resetError();
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="error-fallback">
      <Result
        status="error"
        title="發生錯誤"
        subTitle={error?.message || '應用程序出現了問題，請稍後再試。'}
        extra={[
          <Button type="primary" key="home" icon={<HomeOutlined />} onClick={handleGoHome}>
            返回首頁
          </Button>,
          <Button key="reload" icon={<ReloadOutlined />} onClick={handleReload}>
            重新載入
          </Button>,
        ]}
      />
    </div>
  );
};

export default ErrorFallback;

