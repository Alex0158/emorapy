/**
 * 404頁面
 */

import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { HomeOutlined } from '@ant-design/icons';
import { t } from '@/utils/i18n';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title={t('notFound.title')}
      subTitle={t('notFound.subTitle')}
      extra={
        <Button type="primary" icon={<HomeOutlined />} onClick={() => navigate('/')}>
          {t('notFound.backHome')}
        </Button>
      }
    />
  );
};

export default NotFound;

