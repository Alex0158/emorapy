/**
 * 母熊法官組件
 */

import type { CSSProperties } from 'react';
import './BearJudge.less';

interface BearJudgeProps {
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
  appearance?: 'neutral' | 'bear' | 'balance';
  className?: string;
  style?: CSSProperties;
}

const BearJudge = ({
  size = 'medium',
  animated = true,
  appearance = 'neutral',
  className = '',
  style,
}: BearJudgeProps) => {
  const sizeMap = {
    small: 32,
    medium: 120,
    large: 200,
  };

  const emojiSize = sizeMap[size];
  const iconMap = {
    neutral: '🤝',
    bear: '🐻',
    balance: '⚖️',
  } as const;
  const ariaMap = {
    neutral: '中立調解圖示',
    bear: '熊形象圖示',
    balance: '平衡判斷圖示',
  } as const;

  return (
    <div
      className={`bear-judge ${size} ${animated ? 'animated' : ''} appearance-${appearance} ${className}`}
      style={{ fontSize: `${emojiSize}px`, ...style }}
      role="img"
      aria-label={ariaMap[appearance]}
    >
      <span className="bear-judge__icon" aria-hidden="true">
        {iconMap[appearance]}
      </span>
    </div>
  );
};

export default BearJudge;

