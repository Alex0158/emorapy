/**
 * 進度步驟組件（遷移：Ant Steps → 自定義步驟指示器）
 */

import { cn } from '@/lib/utils';

interface ProgressStepsProps {
  current: number;
  items: Array<{
    title: string;
    description?: React.ReactNode;
    icon?: React.ReactNode;
  }>;
}

const ProgressSteps = ({ current, items }: ProgressStepsProps) => {
  return (
    <div className="flex items-center gap-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2 flex-1">
          <div className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
            index <= current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}>
            {item.icon || index + 1}
          </div>
          <span className={cn('text-xs truncate', index <= current ? 'text-foreground font-medium' : 'text-muted-foreground')}>
            {item.title}
          </span>
          {index < items.length - 1 && (
            <div className={cn('h-0.5 flex-1 rounded-full', index < current ? 'bg-primary' : 'bg-muted')} />
          )}
        </div>
      ))}
    </div>
  );
};

export default ProgressSteps;
