/**
 * 動畫卡片組件
 */

import { Card } from 'antd';
import type { CardProps } from 'antd/es/card';
import { useEffect, useRef } from 'react';
import { fadeIn, slideIn } from '@/utils/animations';
import './AnimatedCard.less';

interface AnimatedCardProps extends CardProps {
  animation?: 'fade' | 'slide' | 'none';
  animationDirection?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
}

const AnimatedCard = ({
  animation = 'fade',
  animationDirection = 'up',
  delay = 0,
  className = '',
  ...props
}: AnimatedCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardRef.current || animation === 'none') return;

    const timer = setTimeout(() => {
      if (animation === 'fade') {
        fadeIn(cardRef.current!);
      } else if (animation === 'slide') {
        slideIn(cardRef.current!, animationDirection);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [animation, animationDirection, delay]);

  return (
    <div ref={cardRef} className={`animated-card ${className}`}>
      <Card {...props} />
    </div>
  );
};

export default AnimatedCard;

