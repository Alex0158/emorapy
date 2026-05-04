/**
 * 空狀態組件（舊包裝器，保留向下兼容）
 * 新代碼應直接使用 @/components/common/EmptyState
 */

import { Inbox } from 'lucide-react';
import { t } from '@/utils/i18n';

interface EmptyProps {
  description?: string;
  children?: React.ReactNode;
}

const Empty = ({ description = t('common.noData'), children }: EmptyProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox className="size-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{description}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
};

export default Empty;
