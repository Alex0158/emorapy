/**
 * 增強提示組件（封裝Ant Design的Tooltip）
 */

import { Tooltip as AntTooltip } from 'antd';
import type { TooltipProps } from 'antd/es/tooltip';

interface EnhancedTooltipProps extends TooltipProps {
  children: React.ReactNode;
}

const Tooltip = ({ children, ...props }: EnhancedTooltipProps) => {
  return <AntTooltip {...props}>{children}</AntTooltip>;
};

export default Tooltip;

