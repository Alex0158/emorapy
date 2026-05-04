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
  { icon: ReactNode; defaultTitle: string; defaultDescription: string }
> = {
  network: {
    icon: <RefreshCw className="size-8 text-warning" strokeWidth={1.5} />,
    defaultTitle: '連接出了點問題',
    defaultDescription: '看起來網路連接有些不穩定。請檢查您的網路，然後再試一次。',
  },
  notFound: {
    icon: <HelpCircle className="size-8 text-muted-foreground" strokeWidth={1.5} />,
    defaultTitle: '找不到這個頁面',
    defaultDescription: '您要找的內容可能已經移動或不存在了。',
  },
  permission: {
    icon: <AlertCircle className="size-8 text-destructive/70" strokeWidth={1.5} />,
    defaultTitle: '沒有權限查看',
    defaultDescription: '您可能需要登入或聯繫管理員來獲取訪問權限。',
  },
  server: {
    icon: <AlertCircle className="size-8 text-destructive/70" strokeWidth={1.5} />,
    defaultTitle: '服務暫時有問題',
    defaultDescription: '我們的團隊正在處理中。請稍後再試，您的資料不會丟失。',
  },
  generic: {
    icon: <AlertCircle className="size-8 text-muted-foreground" strokeWidth={1.5} />,
    defaultTitle: '出了點小問題',
    defaultDescription: '別擔心，這通常是暫時性的。再試一次看看。',
  },
};

export function PageError({
  variant = 'generic',
  title,
  description,
  onRetry,
  onBack,
  retryLabel = '再試一次',
  backLabel = '返回',
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
        {title ?? config.defaultTitle}
      </h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
        {description ?? config.defaultDescription}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="outline" onClick={onBack} size="sm">
            <ArrowLeft className="size-4" />
            {backLabel}
          </Button>
        )}
        {onRetry && (
          <Button onClick={onRetry} size="sm">
            <RefreshCw className="size-4" />
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export default PageError;
