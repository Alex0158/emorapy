/**
 * 404頁面
 */

import { Result, Button, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { HomeOutlined, ArrowLeftOutlined, RocketOutlined } from '@ant-design/icons';
import { t } from '@/utils/i18n';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title={t('notFound.title')}
      subTitle={t('notFound.subTitle')}
      extra={
        <Space wrap>
          <Button type="primary" icon={<HomeOutlined />} onClick={() => navigate('/')}>
            {t('notFound.backHome')}
          </Button>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            {t('notFound.backPrevious')}
          </Button>
          <Button icon={<RocketOutlined />} onClick={() => navigate('/quick-experience/create')}>
            {t('notFound.goQuickExperience')}
          </Button>
        </Space>
      }
    />
  );
};

export default NotFound;
