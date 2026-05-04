/**
 * 內容感知型骨架屏組件
 *
 * 為不同頁面場景提供匹配內容形狀的骨架屏，
 * 相比通用 Spin 旋轉器，減少 20-30% 的感知加載時間。
 */

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* === Chat Bubble Skeleton === */
export function SkeletonChatBubble({
  align = 'left',
  className,
}: {
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex gap-3 max-w-[75%]',
        align === 'right' ? 'ml-auto flex-row-reverse' : '',
        className,
      )}
    >
      {align === 'left' && <Skeleton className="h-9 w-9 shrink-0 rounded-full" />}
      <div className="flex flex-col gap-2 flex-1">
        <Skeleton className="h-4 w-[85%] rounded-md" />
        <Skeleton className="h-4 w-[60%] rounded-md" />
        {align === 'left' && <Skeleton className="h-4 w-[40%] rounded-md" />}
      </div>
    </div>
  );
}

/* === Chat Page Full Skeleton === */
export function SkeletonChat({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-6 p-4', className)}>
      <SkeletonChatBubble align="left" />
      <SkeletonChatBubble align="right" />
      <SkeletonChatBubble align="left" />
      <SkeletonChatBubble align="right" />
    </div>
  );
}

/* === Dashboard Card Skeleton === */
export function SkeletonDashboardCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-5 space-y-4',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-[40%] rounded-md" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full rounded-md" />
      <Skeleton className="h-3 w-[70%] rounded-md" />
      <div className="flex items-center gap-3 pt-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-24 rounded-md" />
      </div>
    </div>
  );
}

/* === Dashboard Page Full Skeleton === */
export function SkeletonDashboard({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Hero card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <Skeleton className="h-6 w-[50%] rounded-md" />
        <Skeleton className="h-4 w-[80%] rounded-md" />
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>
      </div>
      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonDashboardCard />
        <SkeletonDashboardCard />
        <SkeletonDashboardCard />
      </div>
    </div>
  );
}

/* === Case Row Skeleton === */
export function SkeletonCaseRow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl border border-border bg-card p-4',
        className,
      )}
    >
      <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-[60%] rounded-md" />
        <Skeleton className="h-3 w-[40%] rounded-md" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

/* === Case List Page Skeleton === */
export function SkeletonCaseList({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCaseRow key={i} />
      ))}
    </div>
  );
}

/* === Profile Skeleton === */
export function SkeletonProfile({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Avatar + Name */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32 rounded-md" />
          <Skeleton className="h-3 w-48 rounded-md" />
        </div>
      </div>
      {/* Info cards */}
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}

/* === Form Skeleton === */
export function SkeletonForm({
  fields = 3,
  className,
}: {
  fields?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-5', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-20 rounded-md" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-10 w-32 rounded-full mt-4" />
    </div>
  );
}

/* === Full Page Loading Skeleton (替代 Spin) === */
export function SkeletonPage({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center min-h-[60vh] gap-4', className)}>
      <div className="relative">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
      <Skeleton className="h-4 w-32 rounded-md" />
    </div>
  );
}
