/**
 * 404頁面
 */

import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { HomeOutlined } from '@ant-design/icons';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title="404"
      subTitle="抱歉，您訪問的頁面不存在。"
      extra={
        <Button type="primary" icon={<HomeOutlined />} onClick={() => navigate('/')}>
          返回首頁
        </Button>
      }
    />
  );
};

export default NotFound;

