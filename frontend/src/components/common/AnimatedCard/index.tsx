/**
 * 動畫卡片組件（遷移：Ant Card → shadcn Card + Tailwind）
 */

import { type ReactNode, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCardProps {
  animation?: 'fade' | 'slide' | 'none';
  animationDirection?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  className?: string;
  title?: ReactNode;
  extra?: ReactNode;
  children?: ReactNode;
}

const AnimatedCard = ({
  animation = 'fade',
  animationDirection = 'up',
  delay = 0,
  className = '',
  title,
  extra,
  children,
}: AnimatedCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardRef.current || animation === 'none') return;
    const el = cardRef.current;
    el.style.opacity = '0';
    el.style.transform = animation === 'slide'
      ? `translate${animationDirection === 'up' || animationDirection === 'down' ? 'Y' : 'X'}(${animationDirection === 'up' || animationDirection === 'left' ? '12px' : '-12px'})`
      : 'none';

    const timer = setTimeout(() => {
      el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      el.style.opacity = '1';
      el.style.transform = 'none';
    }, delay);

    return () => clearTimeout(timer);
  }, [animation, animationDirection, delay]);

  return (
    <div ref={cardRef} className={cn('rounded-xl border border-border bg-card p-5 shadow-xs', className)}>
      {(title || extra) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h3 className="text-base font-semibold text-foreground">{title}</h3>}
          {extra}
        </div>
      )}
      {children}
    </div>
  );
};

export default AnimatedCard;
