/**
 * AI 錯誤狀態組件
 *
 * 遷移: Ant Alert → shadcn Alert + Tailwind
 * 保留: data 屬性用於測試
 */

import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIErrorStateProps {
  title: ReactNode;
  description?: ReactNode;
  type?: 'error' | 'warning' | 'info' | 'success';
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

const iconMap = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
} as const;

const styleMap = {
  error: 'border-destructive/30 bg-destructive/5',
  warning: 'border-warning/30 bg-warning/5',
  info: 'border-primary/30 bg-primary-light/50',
  success: 'border-success/30 bg-success/5',
} as const;

export default function AIErrorState({
  title,
  description,
  type = 'error',
  actions,
  footer,
  className,
}: AIErrorStateProps) {
  const normalizedDescription = description === title ? undefined : description;
  const Icon = iconMap[type];

  return (
    <div
      className={className}
      data-ai-error-state="true"
      data-ai-error-type={type}
    >
      <Alert className={cn(styleMap[type])}>
        <Icon className="size-4" />
        <AlertTitle>{title}</AlertTitle>
        {normalizedDescription && (
          <AlertDescription className="mt-1">{normalizedDescription}</AlertDescription>
        )}
        {actions && <div className="mt-3 flex items-center gap-2">{actions}</div>}
      </Alert>
      {footer ? <div data-ai-error-footer="true" className="mt-3">{footer}</div> : null}
    </div>
  );
}
