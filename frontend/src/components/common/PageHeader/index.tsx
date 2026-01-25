/**
 * 頁面標題組件
 */

import { Typography } from 'antd';
import type { ReactNode } from 'react';
import './PageHeader.less';

const { Title, Text } = Typography;

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  icon?: ReactNode;
}

const PageHeader = ({ title, subtitle, extra, icon }: PageHeaderProps) => {
  return (
    <div className="page-header">
      <div className="page-header-content">
        <div className="page-header-title">
          {icon && <span className="page-header-icon">{icon}</span>}
          <div>
            <Title level={2} className="page-header-title-text">
              {title}
            </Title>
            {subtitle && <Text type="secondary">{subtitle}</Text>}
          </div>
        </div>
        {extra && <div className="page-header-extra">{extra}</div>}
      </div>
    </div>
  );
};

export default PageHeader;

