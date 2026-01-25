/**
 * 骨架屏組件
 */

import { Skeleton as AntSkeleton } from 'antd';
import './Skeleton.less';

interface SkeletonProps {
  type?: 'card' | 'form' | 'list' | 'text';
  rows?: number;
  active?: boolean;
}

const Skeleton = ({ type = 'card', rows = 3, active = true }: SkeletonProps) => {
  if (type === 'card') {
    return (
      <div className="skeleton-card">
        <AntSkeleton.Image active={active} style={{ width: '100%', height: 200 }} />
        <AntSkeleton active={active} paragraph={{ rows: 3 }} />
      </div>
    );
  }

  if (type === 'form') {
    return (
      <div className="skeleton-form">
        <AntSkeleton.Input active={active} size="large" style={{ marginBottom: 16 }} />
        <AntSkeleton.Input active={active} size="large" style={{ marginBottom: 16 }} />
        <AntSkeleton.Button active={active} size="large" />
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="skeleton-list">
        {Array.from({ length: rows }).map((_, index) => (
          <AntSkeleton key={index} active={active} paragraph={{ rows: 1 }} />
        ))}
      </div>
    );
  }

  return <AntSkeleton active={active} paragraph={{ rows }} />;
};

export default Skeleton;

