/**
 * 空狀態組件
 */

import { Empty as AntEmpty } from 'antd';
import type { EmptyProps } from 'antd/es/empty';

interface EmptyStateProps extends EmptyProps {
  description?: string;
  action?: React.ReactNode;
}

const Empty = ({ description = '暫無數據', action, ...props }: EmptyStateProps) => {
  return (
    <AntEmpty
      description={description}
      image={AntEmpty.PRESENTED_IMAGE_SIMPLE}
      {...props}
    >
      {action}
    </AntEmpty>
  );
};

export default Empty;

