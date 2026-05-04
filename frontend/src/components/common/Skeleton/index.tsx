/**
 * 骨架屏組件（舊接口包裝器）
 *
 * 遷移：Ant Skeleton → shadcn Skeleton 原語
 * 新代碼應直接使用 @/components/common/SkeletonVariants 或 @/components/ui/skeleton
 */

import { Skeleton as ShadcnSkeleton } from '@/components/ui/skeleton';

interface SkeletonProps {
  type?: 'card' | 'form' | 'list' | 'text';
  rows?: number;
  active?: boolean;
}

const Skeleton = ({ type = 'card', rows = 3 }: SkeletonProps) => {
  if (type === 'card') {
    return (
      <div className="skeleton-card space-y-4">
        <ShadcnSkeleton className="h-[200px] w-full rounded-lg" />
        <ShadcnSkeleton className="h-4 w-[85%] rounded-md" />
        <ShadcnSkeleton className="h-4 w-[70%] rounded-md" />
        <ShadcnSkeleton className="h-4 w-[50%] rounded-md" />
      </div>
    );
  }

  if (type === 'form') {
    return (
      <div className="skeleton-form space-y-4">
        <ShadcnSkeleton className="h-10 w-full rounded-lg" />
        <ShadcnSkeleton className="h-10 w-full rounded-lg" />
        <ShadcnSkeleton className="h-9 w-24 rounded-lg" />
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="skeleton-list space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <ShadcnSkeleton key={index} className="h-6 w-full rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <ShadcnSkeleton key={index} className="h-4 w-full rounded-md" />
      ))}
    </div>
  );
};

export default Skeleton;
