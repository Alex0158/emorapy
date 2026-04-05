import type { ReactNode } from 'react';
import { Alert } from 'antd';

interface AIErrorStateProps {
  title: ReactNode;
  description?: ReactNode;
  type?: 'error' | 'warning' | 'info' | 'success';
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export default function AIErrorState({
  title,
  description,
  type = 'error',
  actions,
  footer,
  className,
}: AIErrorStateProps) {
  const normalizedDescription = description === title ? undefined : description;

  return (
    <div
      className={className}
      data-ai-error-state="true"
      data-ai-error-type={type}
    >
      <Alert
        title={title}
        description={normalizedDescription}
        type={type}
        showIcon
        action={actions}
      />
      {footer ? <div data-ai-error-footer="true">{footer}</div> : null}
    </div>
  );
}
