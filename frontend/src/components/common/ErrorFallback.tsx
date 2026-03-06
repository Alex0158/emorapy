import { Result, Button, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { t } from '@/utils/i18n';

interface Props {
  error?: Error;
  resetError: () => void;
}

const ErrorFallback = ({ error, resetError }: Props) => {
  const isDev = import.meta.env.DEV;
  const message = isDev && error?.message ? error.message : t('errorFallback.unknown');
  return (
    <div style={{ padding: 24 }}>
      <Result
        status="error"
        title={t('errorFallback.title')}
        subTitle={message}
        extra={[
          <Button key="retry" type="primary" icon={<ReloadOutlined />} onClick={resetError}>
            {t('errorFallback.retry')}
          </Button>,
          <Button key="reload" onClick={() => location.reload()}>
            {t('errorFallback.reload')}
          </Button>,
        ]}
      />
      <Typography.Paragraph type="secondary" style={{ textAlign: 'center' }}>
        {t('errorFallback.hint')}
      </Typography.Paragraph>
    </div>
  );
};

export default ErrorFallback;
