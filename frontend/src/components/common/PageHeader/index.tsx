/**
 * 頁面標題組件（遷移：Ant Typography → Tailwind）
 */

import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  icon?: ReactNode;
}

const PageHeader = ({ title, subtitle, extra, icon }: PageHeaderProps) => {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {icon && <span className="text-primary">{icon}</span>}
        <div>
          <h2 className="text-2xl font-bold text-foreground font-heading">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {extra && <div>{extra}</div>}
    </div>
  );
};

export default PageHeader;
