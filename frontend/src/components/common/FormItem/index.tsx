/**
 * 表單項組件（簡化版，用於過渡期間保持接口兼容）
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EnhancedFormItemProps {
  children: ReactNode;
  label?: ReactNode;
  name?: string;
  className?: string;
  showErrorInline?: boolean;
  required?: boolean;
  style?: React.CSSProperties;
}

const FormItem = ({ children, label, className, required }: EnhancedFormItemProps) => {
  return (
    <div className={cn('mb-4', className)}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          {required && <span className="text-destructive mr-1">*</span>}
          {label}
        </label>
      )}
      {children}
    </div>
  );
};

export default FormItem;
