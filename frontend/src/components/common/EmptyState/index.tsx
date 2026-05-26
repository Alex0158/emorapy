/**
 * 品牌化空狀態組件
 *
 * 情境感知的空狀態顯示，帶友善文案和明確的下一步行動。
 * 泛用空狀態組件。
 */

import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  FileText,
  ListChecks,
  Bell,
  Search,
  MessageCircle,
  Sparkles,
} from 'lucide-react';

type EmptyStateVariant =
  | 'cases'
  | 'executions'
  | 'notifications'
  | 'search'
  | 'chat'
  | 'default';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  className?: string;
}

const variantConfig: Record<
  EmptyStateVariant,
  { icon: ReactNode; defaultTitle: string; defaultDescription: string }
> = {
  cases: {
    icon: <FileText className="size-10 text-primary/60" strokeWidth={1.5} />,
    defaultTitle: '還沒有案件',
    defaultDescription: '準備好了嗎？建立您的第一個案件，讓我們一起找到解決方案。',
  },
  executions: {
    icon: <ListChecks className="size-10 text-primary/60" strokeWidth={1.5} />,
    defaultTitle: '暫無執行中的方案',
    defaultDescription: '在收到判定後，選擇和好方案即可在這裡追蹤進度。',
  },
  notifications: {
    icon: <Bell className="size-10 text-primary/60" strokeWidth={1.5} />,
    defaultTitle: '沒有新通知',
    defaultDescription: '當有新的進展時，我們會在這裡提醒您。',
  },
  search: {
    icon: <Search className="size-10 text-muted-foreground/60" strokeWidth={1.5} />,
    defaultTitle: '找不到相關結果',
    defaultDescription: '試試不同的關鍵字，或調整篩選條件。',
  },
  chat: {
    icon: <MessageCircle className="size-10 text-primary/60" strokeWidth={1.5} />,
    defaultTitle: '對話即將開始',
    defaultDescription: '在這裡與對方展開真誠的溝通。',
  },
  default: {
    icon: <Sparkles className="size-10 text-primary/60" strokeWidth={1.5} />,
    defaultTitle: '這裡還沒有內容',
    defaultDescription: '之後會有更多內容出現在這裡。',
  },
};

export function EmptyState({
  variant = 'default',
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className,
}: EmptyStateProps) {
  const config = variantConfig[variant];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-16 px-6',
        className,
      )}
    >
      {/* Icon container with subtle background */}
      <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-light/50 mb-5">
        {icon ?? config.icon}
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title ?? config.defaultTitle}
      </h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
        {description ?? config.defaultDescription}
      </p>

      {/* Action button */}
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="mt-6"
          size="lg"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
