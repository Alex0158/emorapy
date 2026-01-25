/**
 * 母熊法官組件
 */

import type { CSSProperties } from 'react';
import './BearJudge.less';

interface BearJudgeProps {
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
  className?: string;
  style?: CSSProperties;
}

const BearJudge = ({ size = 'medium', animated = true, className = '', style }: BearJudgeProps) => {
  const sizeMap = {
    small: 32,
    medium: 120,
    large: 200,
  };

  const emojiSize = sizeMap[size];

  return (
    <div
      className={`bear-judge ${size} ${animated ? 'animated' : ''} ${className}`}
      style={{ fontSize: `${emojiSize}px`, ...style }}
    >
      🐻
    </div>
  );
};

export default BearJudge;

