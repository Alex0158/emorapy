/**
 * 加載組件
 */

import { Spin } from 'antd';
import { t } from '@/utils/i18n';
import './Loading.less';

const Loading = () => {
  return (
    <div className="loading-container">
      <Spin size="large" tip={t('common.loading')} />
    </div>
  );
};

export default Loading;

