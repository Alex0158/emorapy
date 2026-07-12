/**
 * 責任比例展示組件（遷移：Ant Typography → Tailwind）
 */

import { t } from '@/utils/i18n';
import type { ResponsibilityRatio as ResponsibilityRatioType } from '@/types/common';
import { cn } from '@/lib/utils';

interface ResponsibilityRatioProps {
  ratio: ResponsibilityRatioType;
  showLabels?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const sizeMap = { small: 'gap-3', medium: 'gap-4', large: 'gap-6' };

const ResponsibilityRatio = ({ ratio, showLabels = true, size = 'medium' }: ResponsibilityRatioProps) => {
  if (!ratio) return null;
  const p = Number(ratio.plaintiff);
  const d = Number(ratio.defendant);
  if (Number.isNaN(p) || Number.isNaN(d) || p < 0 || d < 0) return null;

  return (
    <div className={cn('flex flex-col', sizeMap[size])}>
      {showLabels && (
        <div className="grid grid-cols-2 divide-x divide-border border-y border-border py-4">
          <div className="pr-5">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-primary" aria-hidden />
              {t('responsibility.roleA')}
            </div>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{p}%</p>
          </div>
          <div className="pl-5">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-secondary" aria-hidden />
              {t('responsibility.roleB')}
            </div>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{d}%</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponsibilityRatio;
