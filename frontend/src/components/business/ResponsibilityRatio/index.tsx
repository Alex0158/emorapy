/**
 * 責任比例展示組件（遷移：Ant Typography → Tailwind）
 */

import { COLORS } from '@/utils/constants';
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
    <div className={cn('flex flex-col items-center', sizeMap[size])}>
      {/* Progress bar */}
      <div className="w-full rounded-full overflow-hidden h-4 flex">
        <div style={{ width: `${p}%`, background: COLORS.primary }} className="flex items-center justify-center text-[10px] font-bold text-white">
          {p > 10 && `${p}%`}
        </div>
        <div style={{ width: `${d}%`, background: COLORS.secondary }} className="flex items-center justify-center text-[10px] font-bold text-white">
          {d > 10 && `${d}%`}
        </div>
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS.primary }} />
            <span className="text-sm font-semibold text-foreground">{t('responsibility.roleA')} {p}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS.secondary }} />
            <span className="text-sm font-semibold text-foreground">{t('responsibility.roleB')} {d}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponsibilityRatio;
