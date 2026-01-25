/**
 * 加載組件
 */

import { Spin } from 'antd';
import './Loading.less';

const Loading = () => {
  return (
    <div className="loading-container">
      <Spin size="large" tip="加載中..." />
    </div>
  );
};

export default Loading;

