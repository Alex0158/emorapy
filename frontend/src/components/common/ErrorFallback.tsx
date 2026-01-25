import { Result, Button, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

interface Props {
  error?: Error;
  resetError: () => void;
}

const ErrorFallback = ({ error, resetError }: Props) => {
  const message = error?.message || '發生未知錯誤';
  return (
    <div style={{ padding: 24 }}>
      <Result
        status="error"
        title="頁面出錯了"
        subTitle={message}
        extra={[
          <Button key="retry" type="primary" icon={<ReloadOutlined />} onClick={resetError}>
            重試
          </Button>,
          <Button key="reload" onClick={() => location.reload()}>
            重新載入
          </Button>,
        ]}
      />
      <Typography.Paragraph type="secondary" style={{ textAlign: 'center' }}>
        若問題持續，請稍後再試或聯絡支持
      </Typography.Paragraph>
    </div>
  );
};

export default ErrorFallback;
