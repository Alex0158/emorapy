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
import { t } from '@/utils/i18n';

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
  { icon: ReactNode; titleKey: string; descriptionKey: string }
> = {
  cases: {
    icon: <FileText className="size-10 text-primary/60" strokeWidth={1.5} />,
    titleKey: 'emptyState.cases.title',
    descriptionKey: 'emptyState.cases.description',
  },
  executions: {
    icon: <ListChecks className="size-10 text-primary/60" strokeWidth={1.5} />,
    titleKey: 'emptyState.executions.title',
    descriptionKey: 'emptyState.executions.description',
  },
  notifications: {
    icon: <Bell className="size-10 text-primary/60" strokeWidth={1.5} />,
    titleKey: 'emptyState.notifications.title',
    descriptionKey: 'emptyState.notifications.description',
  },
  search: {
    icon: <Search className="size-10 text-muted-foreground/60" strokeWidth={1.5} />,
    titleKey: 'emptyState.search.title',
    descriptionKey: 'emptyState.search.description',
  },
  chat: {
    icon: <MessageCircle className="size-10 text-primary/60" strokeWidth={1.5} />,
    titleKey: 'emptyState.chat.title',
    descriptionKey: 'emptyState.chat.description',
  },
  default: {
    icon: <Sparkles className="size-10 text-primary/60" strokeWidth={1.5} />,
    titleKey: 'emptyState.default.title',
    descriptionKey: 'emptyState.default.description',
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
        {title ?? t(config.titleKey)}
      </h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
        {description ?? t(config.descriptionKey)}
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
