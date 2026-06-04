/**
 * 頁面錯誤組件
 *
 * 統一的友善錯誤訊息顯示，帶情境恢復選項。
 * 替代散落在頁面中的 Alert type="error" 模式。
 *
 * 設計原則：
 * - 用人話解釋，不顯示技術細節
 * - 提供明確的恢復路徑
 * - 保持品牌溫暖語調
 */

import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { t } from '@/utils/i18n';
import { AlertCircle, RefreshCw, ArrowLeft, HelpCircle } from 'lucide-react';

type ErrorVariant = 'network' | 'notFound' | 'permission' | 'server' | 'generic';

interface PageErrorProps {
  variant?: ErrorVariant;
  title?: string;
  description?: string;
  onRetry?: () => void;
  onBack?: () => void;
  retryLabel?: string;
  backLabel?: string;
  icon?: ReactNode;
  className?: string;
}

const variantConfig: Record<
  ErrorVariant,
  { icon: ReactNode; titleKey: string; descriptionKey: string }
> = {
  network: {
    icon: <RefreshCw className="size-8 text-warning" strokeWidth={1.5} />,
    titleKey: 'pageError.network.title',
    descriptionKey: 'pageError.network.description',
  },
  notFound: {
    icon: <HelpCircle className="size-8 text-muted-foreground" strokeWidth={1.5} />,
    titleKey: 'pageError.notFound.title',
    descriptionKey: 'pageError.notFound.description',
  },
  permission: {
    icon: <AlertCircle className="size-8 text-destructive/70" strokeWidth={1.5} />,
    titleKey: 'pageError.permission.title',
    descriptionKey: 'pageError.permission.description',
  },
  server: {
    icon: <AlertCircle className="size-8 text-destructive/70" strokeWidth={1.5} />,
    titleKey: 'pageError.server.title',
    descriptionKey: 'pageError.server.description',
  },
  generic: {
    icon: <AlertCircle className="size-8 text-muted-foreground" strokeWidth={1.5} />,
    titleKey: 'pageError.generic.title',
    descriptionKey: 'pageError.generic.description',
  },
};

export function PageError({
  variant = 'generic',
  title,
  description,
  onRetry,
  onBack,
  retryLabel,
  backLabel,
  icon,
  className,
}: PageErrorProps) {
  const config = variantConfig[variant];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-16 px-6',
        className,
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-5">
        {icon ?? config.icon}
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title ?? t(config.titleKey)}
      </h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
        {description ?? t(config.descriptionKey)}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="outline" onClick={onBack} size="sm">
            <ArrowLeft className="size-4" />
            {backLabel ?? t('pageError.back')}
          </Button>
        )}
        {onRetry && (
          <Button onClick={onRetry} size="sm">
            <RefreshCw className="size-4" />
            {retryLabel ?? t('pageError.retry')}
          </Button>
        )}
      </div>
    </div>
  );
}

export default PageError;
