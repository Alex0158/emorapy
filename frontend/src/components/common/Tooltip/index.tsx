/**
 * 增強提示組件（遷移：Ant Tooltip → shadcn Tooltip）
 */

import { Tooltip as ShadcnTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EnhancedTooltipProps {
  title?: React.ReactNode;
  children: React.ReactNode;
  placement?: string;
}

const Tooltip = ({ title, children }: EnhancedTooltipProps) => {
  if (!title) return <>{children}</>;

  return (
    <TooltipProvider>
      <ShadcnTooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>{title}</TooltipContent>
      </ShadcnTooltip>
    </TooltipProvider>
  );
};

export default Tooltip;
