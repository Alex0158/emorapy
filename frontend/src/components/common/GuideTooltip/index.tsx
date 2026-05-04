/**
 * 引導提示組件（遷移：Ant Tooltip/Button → shadcn Popover + Tailwind）
 */

import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { localStore } from '@/utils/storage';

interface GuideTooltipProps {
  children: React.ReactNode;
  content: string;
  storageKey: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  showOnce?: boolean;
}

const GuideTooltip = ({ children, content, storageKey, showOnce = true }: GuideTooltipProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (showOnce) {
      if (!localStore.get<boolean>(storageKey)) setVisible(true);
    } else {
      setVisible(true);
    }
  }, [storageKey, showOnce]);

  const handleClose = () => {
    setVisible(false);
    if (showOnce) localStore.set(storageKey, true);
  };

  if (!visible) return <>{children}</>;

  return (
    <div className="relative inline-block">
      {children}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background shadow-lg whitespace-nowrap">
        <span>{content}</span>
        <button onClick={handleClose} className="text-background/70 hover:text-background"><X className="size-3" /></button>
      </div>
    </div>
  );
};

export default GuideTooltip;
