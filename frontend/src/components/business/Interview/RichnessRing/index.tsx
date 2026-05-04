/**
 * 訪談豐富度環形指示器
 *
 * 顯示訪談深度的視覺反饋（0-1 分數）。
 * 遷移: Ant Progress circle + Typography → 自定義 SVG 環 + Tailwind
 */

import React from 'react';
import { t } from '@/utils/i18n';

interface RichnessRingProps {
  score: number; // 0-1
  size?: number;
  showLabel?: boolean;
  hasDomainProgress?: boolean;
}

function getRichnessLabel(score: number, hasDomainProgress = false): string {
  if (score < 0.05) {
    return hasDomainProgress ? t('psychProfile.richnessEarlyStage') : t('psychProfile.richnessNotStarted');
  }
  if (score < 0.3) return t('psychProfile.richnessGettingToKnow');
  if (score < 0.6) return t('psychProfile.richnessGoodUnderstanding');
  return t('psychProfile.richnessDeepUnderstanding');
}

function getRichnessColor(score: number): string {
  if (score < 0.05) return 'var(--color-muted-foreground)';
  if (score < 0.3) return 'oklch(0.75 0.14 75)';  // warning/amber
  if (score < 0.6) return 'oklch(0.60 0.15 250)';  // blue
  return 'oklch(0.62 0.15 155)';  // success/green
}

const RichnessRing: React.FC<RichnessRingProps> = ({
  score,
  size = 80,
  showLabel = true,
  hasDomainProgress = false,
}) => {
  const percent = Math.round(score * 100);
  const color = getRichnessColor(score);
  const label = getRichnessLabel(score, hasDomainProgress);

  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth={strokeWidth}
          />
          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        {/* Center text */}
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">
          {percent}%
        </span>
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  );
};

export default RichnessRing;
